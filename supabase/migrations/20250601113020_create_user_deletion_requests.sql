-- Create a table to track user deletion requests
-- This avoids needing admin API access for user deletion

CREATE TABLE public.user_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Set up row-level security
ALTER TABLE public.user_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins to create deletion requests
CREATE POLICY "Admins can create deletion requests"
  ON public.user_deletion_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Create policy to allow admins to view deletion requests
CREATE POLICY "Admins can view deletion requests"
  ON public.user_deletion_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );
