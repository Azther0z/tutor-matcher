import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function SignupPage() {
  return (
    <RoutePlaceholder
      title="Create your account"
      description="The registration flow will let learners and tutors choose a role and provide consent."
      backlogIds={["AUTH-1", "AUTH-5", "AUTH-6"]}
    />
  );
}
