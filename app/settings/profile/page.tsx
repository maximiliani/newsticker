import {PageHeading} from '@/components/ui/page-heading';
import {ProfileSettings} from '@/components/user/profile-settings';
import {DashboardShell} from "@/components/shell";

export default function ProfilePage() {
    return (
        <DashboardShell>
            <PageHeading
                heading="Profile Settings"
                text="Update your personal information and profile details."
            />
            <div className="my-8">
                <ProfileSettings/>
            </div>
        </DashboardShell>
    );
}
