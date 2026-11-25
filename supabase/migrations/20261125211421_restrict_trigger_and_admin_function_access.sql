REVOKE EXECUTE ON FUNCTION public.cleanup_instagram_account_storage()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.make_first_user_admin()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_roles()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_users_secure()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_all_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO authenticated, service_role;