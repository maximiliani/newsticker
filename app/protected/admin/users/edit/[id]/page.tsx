import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/features/users/services/user-service';
import { UserProfileEditor } from '@/features/users/components/user-profile-editor';
import { PageHeading } from '@/components/ui/page-heading';
import { DashboardShell } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function AdminUserEditPage({ params }: { params: { id: string } }) {
  // Check if the user is authenticated and admin
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const isAdmin = await UserService.isCurrentUserAdmin();
  if (!isAdmin) redirect('/protected');

  // Fetch the user being edited
  let userToEdit = null;
  try {
    userToEdit = await UserService.getUserById(params.id);
    if (!userToEdit) {
      redirect('/protected/admin/users');
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    redirect('/protected/admin/users');
  }

  return (
    <DashboardShell>
      <div className="flex items-center justify-between">
        <PageHeading
          heading="Edit User Profile"
          text={`Editing user: ${userToEdit.full_name || userToEdit.email}`}
        />
        <Link href="/protected/admin/users" passHref>
          <Button variant="outline">Back to Users</Button>
        </Link>
      </div>

      <Suspense fallback={<div className="my-8"><Skeleton className="h-[500px] w-full" /></div>}>
        <UserProfileEditor user={userToEdit} />
      </Suspense>
    </DashboardShell>
  );
}
