import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeading } from '@/components/ui/page-heading';
import { DashboardShell } from '@/components/shell';
import { GeneralSettings } from '@/components/admin/general-settings';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export default async function GeneralSettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc("check_is_admin");
  if (!isAdmin) redirect('/settings?error=permission&message=You do not have permission to access this page');

  const t = await getTranslations("GeneralSettings");

  return (
    <DashboardShell>
      <PageHeading
        heading={t("title")}
        text={t("description")}
      />

      <div className="my-8">
        <GeneralSettings />
      </div>
    </DashboardShell>
  );
}
