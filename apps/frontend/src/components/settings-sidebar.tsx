import Link from "next/link";

type SettingsSection = "account" | "student";

const settingsLinks: Array<{ section: SettingsSection; href: string; label: string }> = [
  { section: "account", href: "/settings/account", label: "Account" },
  { section: "student", href: "/settings/student", label: "Student profile" },
];

export function SettingsSidebar({ activeSection }: { activeSection: SettingsSection }) {
  return (
    <nav
      aria-label="Settings"
      className="flex w-full flex-none flex-col gap-1 rounded-2xl border border-black/[.12] p-3 sm:w-56 dark:border-white/[.18]"
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
                ? "rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background"
                : "rounded-lg px-3 py-2 text-sm font-medium hover:bg-black/[.06] dark:hover:bg-white/[.08]"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
