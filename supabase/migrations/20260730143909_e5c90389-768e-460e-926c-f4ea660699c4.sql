
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;
CREATE POLICY "profiles_select_family" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.family_members me
    JOIN public.family_members other ON other.family_id = me.family_id
    WHERE me.user_id = auth.uid() AND other.user_id = profiles.id
  )
);

REVOKE EXECUTE ON FUNCTION public.is_family_member(UUID, UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_family_admin(UUID, UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_write_family(UUID, UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.family_role(UUID, UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.redeem_invitation(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_family_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_family(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.family_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;
