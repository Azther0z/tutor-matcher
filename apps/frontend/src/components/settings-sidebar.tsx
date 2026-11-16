import Link from "next/link";

type SettingsSection = "account" | "student" | "tutor" | "notifications" | "wallet";

const settingsLinks: Array<{ section: SettingsSection; href: string; label: string }> = [
  { section: "account", href: "/settings/account", label: "Account" },
  { section: "student", href: "/settings/student", label: "Student profile" },
  { section: "tutor", href: "/settings/tutor", label: "Tutor profile" },
  { section: "notifications", href: "/settings/notifications", label: "Notifications" },
  { section: "wallet", href: "/settings/wallet", label: "Wallet" },
];

export function SettingsSidebar({ activeSection }: { activeSection: SettingsSection }) {
  return (
    <nav
      aria-label="Settings"
      className="flex w-full flex-none flex-row flex-wrap gap-1 sm:sticky sm:top-24 sm:self-start sm:flex-col rounded-2xl border border-line bg-surface p-3 sm:w-60"
    >
      {settingsLinks.map(({ section, href, label }) => {
        const isActive = section === activeSection;

        return (
          <Link
            key={section}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-lg bg-brand-navy min-h-11 px-3 py-3 text-sm font-medium text-white"
                : "rounded-lg min-h-11 px-3 py-3 text-sm font-medium hover:bg-surface-muted"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
