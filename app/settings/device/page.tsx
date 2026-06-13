import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeading } from '@/components/ui/page-heading';
import { DashboardShell } from '@/components/shell';
import { DeviceSettings } from '@/features/device/components/device-settings';

export const dynamic = 'force-dynamic';

/**
 * Device settings page for Raspberry Pi local deployment
 * Accessible only by admins when in kiosk mode.
 */
export default async function DevicePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc("check_is_admin");
  if (!isAdmin) redirect('/settings?error=permission&message=You do not have permission to access this page');

  // Verify kiosk mode (optional extra check, though sidebar link handles it)
  const isKiosk = process.env.NEXT_PUBLIC_KIOSK_MODE === 'true';
  if (!isKiosk && process.env.NODE_ENV === 'production') {
    redirect('/settings');
  }

  return (
    <DashboardShell>
      <PageHeading
        heading="Device Management"
        text="Control and monitor this Raspberry Pi device"
      />

      <DeviceSettings />
    </DashboardShell>
  );
}
