BEGIN;

-- Create a table to store user roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Create an index on is_admin for better query performance
CREATE INDEX IF NOT EXISTS idx_user_roles_is_admin ON public.user_roles(is_admin);

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    admin_status BOOLEAN;
BEGIN
    SELECT is_admin INTO admin_status FROM public.user_roles WHERE user_roles.user_id = $1;
    RETURN COALESCE(admin_status, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view their own role
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Create policy to allow admins to view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.is_admin(auth.uid()));

-- Create policy to allow admins to update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Create policy to allow admins to insert roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Create policy to allow admins to delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
USING (public.is_admin(auth.uid()));

-- Modify Instagram accounts policies to allow admin access
CREATE POLICY "Admins can manage all accounts"
ON instagram_accounts FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Modify Instagram posts policies to allow admin access
CREATE POLICY "Admins can manage all posts"
ON instagram_posts FOR ALL
USING (public.is_admin(auth.uid()));

-- Modify Instagram post media policies to allow admin access
CREATE POLICY "Admins can manage all media"
ON instagram_post_media FOR ALL
USING (public.is_admin(auth.uid()));

-- Modify articles policies to allow admin access
CREATE POLICY "Admins can manage all articles"
ON public.articles FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Create a function to make the first user an admin
CREATE OR REPLACE FUNCTION public.make_first_user_admin()
RETURNS TRIGGER AS $$
DECLARE
    user_count INTEGER;
BEGIN
    -- Count existing users
    SELECT COUNT(*) INTO user_count FROM public.user_roles;
    
    -- If this is the first user, make them an admin
    IF user_count = 0 THEN
        INSERT INTO public.user_roles (user_id, is_admin)
        VALUES (NEW.id, true);
    ELSE
        -- Otherwise, insert with default values (not admin)
        INSERT INTO public.user_roles (user_id, is_admin)
        VALUES (NEW.id, false);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to make the first user an admin
CREATE TRIGGER make_first_user_admin_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.make_first_user_admin();

-- Insert existing users into user_roles table
-- First user will be admin, others will not
DO $$
DECLARE
    first_user UUID;
    u UUID;
BEGIN
    -- Get the ID of the first user (by creation date)
    SELECT id INTO first_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
    
    -- Insert all existing users
    FOR u IN SELECT id FROM auth.users
    LOOP
        -- First user is admin, others are not
        INSERT INTO public.user_roles (user_id, is_admin)
        VALUES (u, u = first_user)
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END;
$$;

COMMIT;