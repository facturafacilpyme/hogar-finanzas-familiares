-- 1. Nuevo tipo de notificación
ALTER TYPE public.notif_type ADD VALUE IF NOT EXISTS 'pago_total_pendiente';

-- 2. Invitaciones con datos de la persona
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT;
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations (lower(email));

-- 3. Deudas: comprobante de pago total
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS settlement_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_by UUID;

-- 4. Alta de usuario: solo crea familia si NO viene invitado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uname TEXT;
  fid UUID;
  inv public.invitations;
BEGIN
  uname := COALESCE(NULLIF(NEW.raw_user_meta_data->>'name',''), split_part(NEW.email, '@', 1));
  INSERT INTO public.profiles (id, email, name) VALUES (NEW.id, NEW.email, uname);

  SELECT * INTO inv
    FROM public.invitations i
   WHERE lower(i.email) = lower(NEW.email)
     AND i.accepted_at IS NULL
     AND i.expires_at > now()
   ORDER BY i.created_at DESC
   LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.family_members (family_id, user_id, role)
    VALUES (inv.family_id, NEW.id, inv.role)
    ON CONFLICT (family_id, user_id) DO NOTHING;
    UPDATE public.invitations SET accepted_by = NEW.id, accepted_at = now() WHERE id = inv.id;
  ELSE
    INSERT INTO public.families (name, created_by)
    VALUES ('Familia de ' || uname, NEW.id) RETURNING id INTO fid;
    INSERT INTO public.family_members (family_id, user_id, role) VALUES (fid, NEW.id, 'admin');
  END IF;

  RETURN NEW;
END; $function$;

-- 5. Canje de invitación por link (sin ambigüedad de nombres)
DROP FUNCTION IF EXISTS public.redeem_invitation(text);
CREATE OR REPLACE FUNCTION public.redeem_invitation(_token text)
RETURNS TABLE(out_family_id uuid, out_role app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE inv public.invitations; uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO inv FROM public.invitations i WHERE i.token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Invitación expirada'; END IF;
  IF inv.accepted_at IS NOT NULL AND inv.accepted_by IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'Invitación ya utilizada';
  END IF;

  INSERT INTO public.family_members AS fm (family_id, user_id, role)
  VALUES (inv.family_id, uid, inv.role)
  ON CONFLICT (family_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.invitations i SET accepted_by = uid, accepted_at = now() WHERE i.id = inv.id;

  -- si el usuario solo estaba en su familia autogenerada y vacía, la eliminamos
  DELETE FROM public.families f
   WHERE f.created_by = uid
     AND f.id <> inv.family_id
     AND (SELECT count(*) FROM public.family_members m WHERE m.family_id = f.id) = 1
     AND NOT EXISTS (SELECT 1 FROM public.debts d WHERE d.family_id = f.id)
     AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.family_id = f.id)
     AND NOT EXISTS (SELECT 1 FROM public.savings_goals g WHERE g.family_id = f.id);

  RETURN QUERY SELECT inv.family_id, inv.role;
END; $function$;

REVOKE ALL ON FUNCTION public.redeem_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(text) TO authenticated;

-- 6. Consultar una invitación de forma pública (para la pantalla de registro por link)
CREATE OR REPLACE FUNCTION public.invitation_info(_token text)
RETURNS TABLE(family_name text, role app_role, email text, name text, valid boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT f.name, i.role, i.email, i.name,
         (i.accepted_at IS NULL AND i.expires_at > now())
    FROM public.invitations i
    JOIN public.families f ON f.id = i.family_id
   WHERE i.token = _token;
$function$;
REVOKE ALL ON FUNCTION public.invitation_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitation_info(text) TO anon, authenticated;

-- 7. Permisos de admin sobre ahorros y gastos
DROP POLICY IF EXISTS sg_update ON public.savings_goals;
CREATE POLICY sg_update ON public.savings_goals FOR UPDATE TO authenticated
  USING (public.is_family_admin(family_id, auth.uid()));
DROP POLICY IF EXISTS sg_delete ON public.savings_goals;
CREATE POLICY sg_delete ON public.savings_goals FOR DELETE TO authenticated
  USING (public.is_family_admin(family_id, auth.uid()));

DROP POLICY IF EXISTS sc_update ON public.savings_contributions;
CREATE POLICY sc_update ON public.savings_contributions FOR UPDATE TO authenticated
  USING (public.is_family_admin(family_id, auth.uid()));
DROP POLICY IF EXISTS sc_delete ON public.savings_contributions;
CREATE POLICY sc_delete ON public.savings_contributions FOR DELETE TO authenticated
  USING (public.is_family_admin(family_id, auth.uid()));

DROP POLICY IF EXISTS exp_update ON public.expenses;
CREATE POLICY exp_update ON public.expenses FOR UPDATE TO authenticated
  USING (paid_by = auth.uid() OR public.is_family_admin(family_id, auth.uid()));
DROP POLICY IF EXISTS exp_delete ON public.expenses;
CREATE POLICY exp_delete ON public.expenses FOR DELETE TO authenticated
  USING (paid_by = auth.uid() OR public.is_family_admin(family_id, auth.uid()));

-- 8. Limpieza total de datos
TRUNCATE public.activity_log, public.notifications, public.savings_contributions,
         public.savings_goal_members, public.savings_goals, public.expenses,
         public.payments, public.debt_members, public.debts, public.invitations,
         public.family_members, public.families CASCADE;
DELETE FROM public.profiles;
DELETE FROM auth.users;