import { Metadata } from "next";
import { SubscriptionManager } from "@/features/calendar/components/subscription-manager";

export const metadata: Metadata = {
  title: "Calendar Subscriptions | Settings",
  description: "Manage your calendar subscriptions",
};

export default function CalendarSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Calendar Subscriptions</h3>
        <p className="text-sm text-muted-foreground">
          Subscribe to external calendars to see events in your feed.
        </p>
      </div>
      <SubscriptionManager />
    </div>
  );
}
