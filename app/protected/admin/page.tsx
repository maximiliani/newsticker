import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/features/users/services/user-service';
import { PageHeading } from '@/components/ui/page-heading';
import { DashboardShell } from '@/components/shell';
import { AdminDashboardCards } from '@/features/admin/components/admin-dashboard-cards';

export default async function AdminDashboardPage() {
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
  if (!isAdmin) redirect('/protected');

  return (
    <DashboardShell>
      <PageHeading
        heading="Admin Dashboard"
        text="Manage all aspects of your platform"
      />

      <AdminDashboardCards />
    </DashboardShell>
  );
}
