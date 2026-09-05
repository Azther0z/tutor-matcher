import { redirect } from "next/navigation";

// The product route model splits settings into /settings/account,
// /settings/notifications, /settings/wallet, and /settings/tutor. Account
// settings are the landing page for the section.
export default function SettingsPage() {
  redirect("/settings/account");
}
