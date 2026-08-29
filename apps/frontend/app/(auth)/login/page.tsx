import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function LoginPage() {
  return (
    <RoutePlaceholder
      title="Log in"
      description="The email and password authentication flow will be implemented here."
      backlogIds={["AUTH-2", "AUTH-3"]}
    />
  );
}
