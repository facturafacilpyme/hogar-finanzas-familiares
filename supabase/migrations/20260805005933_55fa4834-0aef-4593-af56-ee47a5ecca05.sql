CREATE OR REPLACE FUNCTION public.can_save_family(_family_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = _family_id AND user_id = _user_id
      AND role IN ('admin','miembro','educativo')
  );
$$;

DROP POLICY IF EXISTS sc_insert ON public.savings_contributions;
CREATE POLICY sc_insert ON public.savings_contributions FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.can_save_family(
    (SELECT g.family_id FROM public.savings_goals g WHERE g.id = savings_contributions.goal_id),
    auth.uid()
  )
);

DROP POLICY IF EXISTS sgm_insert ON public.savings_goal_members;
CREATE POLICY sgm_insert ON public.savings_goal_members FOR INSERT TO authenticated
WITH CHECK (
  public.can_save_family(
    (SELECT g.family_id FROM public.savings_goals g WHERE g.id = savings_goal_members.goal_id),
    auth.uid()
  )
);
