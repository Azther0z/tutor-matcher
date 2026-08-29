import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function SettingsPage() {
  return (
    <RoutePlaceholder
      title="Account settings"
      description="Learner subjects, levels, goals, and account settings will be managed here."
      backlogIds={["PROF-1", "PROF-4"]}
    />
  );
}
