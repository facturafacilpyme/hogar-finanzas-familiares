
REVOKE EXECUTE ON FUNCTION public.award_badges() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_expired_challenges() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.use_reserve_for_debt(uuid, uuid, uuid, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.use_reserve_for_debt(uuid, uuid, uuid, numeric) TO authenticated;
