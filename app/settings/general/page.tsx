import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeading } from '@/components/ui/page-heading';
import { DashboardShell } from '@/components/shell';
import { GeneralSettings } from '@/components/admin/general-settings';

export const dynamic = 'force-dynamic';

export default async function GeneralSettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc("check_is_admin");
  if (!isAdmin) redirect('/settings?error=permission&message=You do not have permission to access this page');

  return (
    <DashboardShell>
      <PageHeading
        heading="General Settings"
        text="Manage application-wide settings and configuration"
      />

      <div className="my-8">
        <GeneralSettings />
      </div>
    </DashboardShell>
  );
}
