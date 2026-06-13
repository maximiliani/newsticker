import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with service role privileges.
 * 
 * NOTE: In this system, admins are regular users that have the 'isAdmin' flag 
 * set in their user metadata. This is used for user management and high-level 
 * administrative tasks. The service role client bypasses Row Level Security (RLS).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase admin environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
