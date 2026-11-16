import Link from "next/link";

type SettingsSection = "account" | "student" | "tutor" | "notifications";

const settingsLinks: Array<{ section: SettingsSection; href: string; label: string }> = [
  { section: "account", href: "/settings/account", label: "Account" },
  { section: "student", href: "/settings/student", label: "Student profile" },
  { section: "tutor", href: "/settings/tutor", label: "Tutor profile" },
  { section: "notifications", href: "/settings/notifications", label: "Notifications" },
];

export function SettingsSidebar({ activeSection }: { activeSection: SettingsSection }) {
  return (
    <nav
      aria-label="Settings"
      className="flex w-full flex-none flex-row gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-2 lg:sticky lg:top-24 lg:self-start lg:w-60 lg:flex-col lg:overflow-visible lg:p-3"
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
                ? "min-h-11 shrink-0 rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium whitespace-nowrap text-white"
                : "min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap hover:bg-surface-muted"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
