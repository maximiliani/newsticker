-- Create a table that will proxy the users view with proper RLS

CREATE TABLE public.users_secure (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN,
  created_at TIMESTAMPTZ
);

-- Populate the table initially
INSERT INTO public.users_secure
SELECT * FROM users_with_roles;

-- Enable RLS on the table
ALTER TABLE public.users_secure ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins to see all users
CREATE POLICY "Admins can see all users"
  ON public.users_secure
  FOR SELECT
  TO authenticated
  USING (check_is_admin());

-- Create policy to allow users to see their own data
CREATE POLICY "Users can see their own data"
  ON public.users_secure
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Create a function to sync the users_secure table with auth.users
CREATE OR REPLACE FUNCTION sync_users_secure()
RETURNS TRIGGER AS $$
BEGIN
  -- For inserts and updates in auth.users
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    INSERT INTO public.users_secure (id, email, full_name, avatar_url, is_admin, created_at)
    SELECT 
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'avatar_url',
      COALESCE((SELECT is_admin FROM public.user_roles WHERE user_id = NEW.id), false),
      NEW.created_at
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      created_at = EXCLUDED.created_at;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM public.users_secure WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to sync user_roles changes
CREATE OR REPLACE FUNCTION sync_user_roles()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users_secure
  SET is_admin = NEW.is_admin
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to keep the tables in sync
CREATE TRIGGER sync_users_trigger
AFTER INSERT OR UPDATE OR DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION sync_users_secure();

CREATE TRIGGER sync_roles_trigger
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION sync_user_roles();
