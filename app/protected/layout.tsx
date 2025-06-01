export const dynamic = 'force-dynamic';

import { ReactNode, Suspense } from 'react';
import { createClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';

async function ProtectedLayoutContent({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return children;
}

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
      </Suspense>
    </div>
  );
}