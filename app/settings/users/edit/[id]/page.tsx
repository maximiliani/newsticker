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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserEditPage({ params }: PageProps) {
  // Check if the user is authenticated and admin
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const isAdmin = await UserService.isCurrentUserAdmin();
  if (!isAdmin) redirect('/settings');

  // Await the params to get the actual values
  const { id } = await params;

  // Fetch the user being edited
  let userToEdit = null;
  try {
    userToEdit = await UserService.getUserById(id);
    if (!userToEdit) {
      redirect('/settings/users');
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    redirect('/settings/users');
  }

  return (
    <DashboardShell>
      <div className="flex items-center justify-between">
        <PageHeading
          heading="Edit User Profile"
          text={`Editing user: ${userToEdit.full_name || userToEdit.email}`}
        />
        <Link href="/settings/users">
          <Button variant="outline">Back to Users</Button>
        </Link>
      </div>

      <Suspense fallback={<div className="my-8"><Skeleton className="h-[500px] w-full" /></div>}>
        <UserProfileEditor user={userToEdit} />
      </Suspense>
    </DashboardShell>
  );
}