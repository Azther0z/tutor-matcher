import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function NotificationSettingsPage() {
  return (
    <RoutePlaceholder
      title="Notification settings"
      description="Notification preferences for bookings, messages, and payments will be configured here."
      backlogIds={["MSG-2"]}
    />
  );
}
