export const dynamic = 'force-dynamic';

import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/features/users/services/user-service';
import { MainNav } from '@/components/main-nav';
import { UserNav } from '@/components/user-nav';

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  // Check if the user is authenticated
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Check if user is admin for navigation
  let isAdmin = false;
  try {
    isAdmin = await UserService.isCurrentUserAdmin();
  } catch (error) {
    console.error('Error checking admin status:', error);
    // Continue even if admin check fails
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container flex items-center justify-between h-16 gap-4">
          <MainNav isAdmin={isAdmin} />
          <UserNav user={user} />
        </div>
      </header>
      <main className="flex-1 container py-6">
        {children}
      </main>
    </div>
  );
}
