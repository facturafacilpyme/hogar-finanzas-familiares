ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS settlement_proof_url text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_due_at timestamptz;

CREATE OR REPLACE FUNCTION public.recalc_goal_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE gid uuid;
BEGIN
  gid := COALESCE(NEW.goal_id, OLD.goal_id);
  UPDATE public.savings_goals sg
     SET current_amount = GREATEST(0, COALESCE((
       SELECT SUM(CASE WHEN c.kind = 'retiro' THEN -c.amount ELSE c.amount END)
         FROM public.savings_contributions c
        WHERE c.goal_id = gid), 0))
   WHERE sg.id = gid;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_update_goal ON public.savings_contributions;
DROP TRIGGER IF EXISTS trg_recalc_goal ON public.savings_contributions;
CREATE TRIGGER trg_recalc_goal
AFTER INSERT OR UPDATE OR DELETE ON public.savings_contributions
FOR EACH ROW EXECUTE FUNCTION public.recalc_goal_amount();

CREATE OR REPLACE FUNCTION public.notify_family_admins(_family_id uuid, _type text, _message text, _related_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE admin_id uuid;
BEGIN
  IF NOT public.is_family_member(_family_id, auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  FOR admin_id IN SELECT user_id FROM public.family_members WHERE family_id = _family_id AND role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, family_id, type, message, related_id)
    VALUES (admin_id, _family_id, _type, _message, _related_id);
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.notify_family_admins(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_family_admins(uuid, text, text, uuid) TO authenticated;