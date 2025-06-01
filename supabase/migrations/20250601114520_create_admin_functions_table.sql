-- Create a table to store results of admin-only functions
-- This provides a safer way to access admin data through RLS

CREATE TABLE public.admin_functions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_name TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on the table
ALTER TABLE public.admin_functions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins to see all function results
CREATE POLICY "Admins can see all function results"
  ON public.admin_functions
  FOR SELECT
  TO authenticated
  USING (check_is_admin());

-- Create a function to get all users safely
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS JSONB AS $$
DECLARE
  user_list JSONB;
  calling_user_id UUID;
  is_admin BOOLEAN;
BEGIN
  -- Get the calling user's ID
  calling_user_id := auth.uid();

  -- Check if the user is an admin
  SELECT ur.is_admin INTO is_admin 
  FROM public.user_roles ur 
  WHERE ur.user_id = calling_user_id;

  IF COALESCE(is_admin, false) = false THEN
    RAISE EXCEPTION 'Permission denied: User is not an admin';
  END IF;

  -- Get the user list
  SELECT json_agg(users_with_roles) INTO user_list
  FROM users_with_roles;

  -- Store the result in the admin_functions table
  INSERT INTO public.admin_functions (function_name, result)
  VALUES ('get_all_users', user_list)
  RETURNING result INTO user_list;

  RETURN user_list;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
