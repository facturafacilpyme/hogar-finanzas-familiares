
-- 1) Unicidad de insignias (una insignia por usuario/código/meta)
CREATE UNIQUE INDEX IF NOT EXISTS badges_user_code_goal_uniq
  ON public.badges (user_id, code, COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 2) Otorgamiento automático de insignias al insertar aportes
CREATE OR REPLACE FUNCTION public.award_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  g public.savings_goals;
  total NUMERIC;
BEGIN
  -- solo los aportes (no retiros) generan insignias
  IF NEW.kind = 'retiro' THEN RETURN NEW; END IF;

  SELECT * INTO g FROM public.savings_goals WHERE id = NEW.goal_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- serializa otorgamiento por usuario para evitar duplicados ante aportes simultáneos
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  -- insignia: primer aporte del usuario en la familia
  IF NOT EXISTS (SELECT 1 FROM public.savings_contributions c WHERE c.user_id = NEW.user_id AND c.kind <> 'retiro' AND c.id <> NEW.id) THEN
    INSERT INTO public.badges (family_id, user_id, code, label, goal_id)
    VALUES (g.family_id, NEW.user_id, 'primer_aporte', 'Primer aporte', NULL)
    ON CONFLICT (user_id, code, (COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid))) DO NOTHING;
  END IF;

  -- insignia: meta completada (se calcula la suma directamente, sin depender del orden de triggers)
  SELECT COALESCE(SUM(CASE WHEN c.kind = 'retiro' THEN -c.amount ELSE c.amount END), 0)
    INTO total
    FROM public.savings_contributions c
   WHERE c.goal_id = NEW.goal_id;

  IF total >= g.target_amount THEN
    INSERT INTO public.badges (family_id, user_id, code, label, goal_id)
    VALUES (g.family_id, NEW.user_id, 'meta_completada', 'Meta completada: ' || g.name, g.id)
    ON CONFLICT (user_id, code, (COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid))) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_award_badges
AFTER INSERT ON public.savings_contributions
FOR EACH ROW EXECUTE FUNCTION public.award_badges();

-- 3) Uso transaccional del Fondo de Reserva para cubrir la deuda de un miembro
CREATE OR REPLACE FUNCTION public.use_reserve_for_debt(_goal_id uuid, _debt_id uuid, _user_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  g public.savings_goals;
  d public.debts;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;

  SELECT * INTO g FROM public.savings_goals WHERE id = _goal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fondo no encontrado'; END IF;
  IF g.goal_kind <> 'reserva' THEN RAISE EXCEPTION 'La meta no es un Fondo de Reserva'; END IF;

  -- solo el admin de la familia puede usar el fondo
  IF NOT public.is_family_admin(g.family_id, uid) THEN RAISE EXCEPTION 'Solo el admin puede usar el Fondo de Reserva'; END IF;

  SELECT * INTO d FROM public.debts WHERE id = _debt_id;
  IF NOT FOUND OR d.family_id <> g.family_id THEN RAISE EXCEPTION 'Deuda no encontrada en la familia'; END IF;

  -- el miembro cubierto debe pertenecer a la familia y ser responsable de la deuda
  IF NOT public.is_family_member(g.family_id, _user_id) THEN RAISE EXCEPTION 'El miembro no pertenece a la familia'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.debt_members dm WHERE dm.debt_id = _debt_id AND dm.user_id = _user_id) THEN
    RAISE EXCEPTION 'El miembro no es responsable de esta deuda';
  END IF;

  -- saldo suficiente (recalculado desde los aportes para no depender del orden de triggers)
  IF COALESCE((SELECT SUM(CASE WHEN c.kind = 'retiro' THEN -c.amount ELSE c.amount END)
                 FROM public.savings_contributions c WHERE c.goal_id = _goal_id), 0) < _amount THEN
    RAISE EXCEPTION 'Saldo insuficiente en el Fondo de Reserva';
  END IF;

  INSERT INTO public.savings_contributions (goal_id, user_id, amount, contribution_date, family_id, created_by, kind, notes)
  VALUES (_goal_id, _user_id, _amount, current_date, g.family_id, uid, 'retiro', 'Uso del Fondo de Reserva para cubrir deuda: ' || d.name);

  INSERT INTO public.payments (debt_id, user_id, amount, payment_date, family_id, created_by, notes)
  VALUES (_debt_id, _user_id, _amount, current_date, g.family_id, uid, 'Cubierto por Fondo de Reserva');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.use_reserve_for_debt(uuid, uuid, uuid, numeric) TO authenticated;

-- 4) Cierre automático de retos semanales
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE OR REPLACE FUNCTION public.close_expired_challenges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  r RECORD;
  winner UUID;
  n INTEGER := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.savings_goals
     WHERE is_challenge AND closed_at IS NULL AND period_end IS NOT NULL AND period_end < current_date
  LOOP
    UPDATE public.savings_goals SET closed_at = now() WHERE id = r.id;
    n := n + 1;

    -- insignia del reto al mayor aportante, solo si la meta común se cumplió
    IF r.current_amount >= r.target_amount THEN
      SELECT c.user_id INTO winner
        FROM public.savings_contributions c
       WHERE c.goal_id = r.id AND c.kind <> 'retiro'
       GROUP BY c.user_id
       ORDER BY SUM(c.amount) DESC
       LIMIT 1;
      IF winner IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext(winner::text));
        INSERT INTO public.badges (family_id, user_id, code, label, goal_id)
        VALUES (r.family_id, winner, 'reto_completado', 'Reto completado: ' || r.name, r.id)
        ON CONFLICT (user_id, code, (COALESCE(goal_id, '00000000-0000-0000-0000-000000000000'::uuid))) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
  RETURN n;
END;
$function$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'cerrar-retos-semanales',
  '5 0 * * *',
  $$ SELECT public.close_expired_challenges(); $$
);
