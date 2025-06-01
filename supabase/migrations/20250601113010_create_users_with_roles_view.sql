-- Create a view that combines user information with their roles
-- This avoids needing admin API access for basic user management

CREATE OR REPLACE VIEW users_with_roles AS
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'full_name' as full_name,
  au.raw_user_meta_data->>'avatar_url' as avatar_url,
  COALESCE(ur.is_admin, false) as is_admin,
  au.created_at
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id;

-- Note: We can't apply RLS policies directly to views in PostgreSQL
-- Instead, we'll create a function that checks admin status

CREATE OR REPLACE FUNCTION check_is_admin() 
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT ur.is_admin INTO is_admin 
  FROM public.user_roles ur 
  WHERE ur.user_id = auth.uid();

  RETURN COALESCE(is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
