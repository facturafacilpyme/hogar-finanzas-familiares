ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS document_note text;

DROP POLICY IF EXISTS "Family admins can update member profiles" ON public.profiles;
CREATE POLICY "Family admins can update member profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.family_members fm
  WHERE fm.user_id = profiles.id
    AND public.is_family_admin(fm.family_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.family_members fm
  WHERE fm.user_id = profiles.id
    AND public.is_family_admin(fm.family_id, auth.uid())
));