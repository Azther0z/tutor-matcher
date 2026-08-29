import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function TutorSettingsPage() {
  return (
    <RoutePlaceholder
      title="Tutor settings"
      description="Tutor profile publishing and weekly availability will be managed here."
      backlogIds={["PROF-2", "PROF-3"]}
    />
  );
}
