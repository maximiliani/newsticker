import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UserManagementWrapper } from '@/features/admin/components/user-management-wrapper';
import { PageHeading } from '@/components/ui/page-heading';
import { DashboardShell } from '@/components/shell';

export const dynamic = 'force-dynamic';

/**
 * User management page component that displays a list of users
 * and allows admins to manage them
 */
export default async function UsersPage() {
  // Check if the user is authenticated and admin
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Check if user is admin using server-side methods
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  const isAdmin = roleData?.is_admin === true;
  if (!isAdmin) redirect('/protected?error=permission&message=You do not have permission to access this page');

  // Fetch users with server component
  const { data: users } = await supabase
    .from('users_secure')
    .select('*');

  return (
    <DashboardShell>
      <PageHeading
        heading="User Management"
        text="Manage user accounts and access permissions"
      />

      <UserManagementWrapper 
        initialUsers={users || []} 
        currentUserId={user.id} 
      />
    </DashboardShell>
  );
}