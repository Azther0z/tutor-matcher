import { redirect } from "next/navigation";

export default function TutorDashboardPage(): never {
  redirect("/dashboard?tab=tutor");
}
