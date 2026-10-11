import type { TutorProfileFields } from "@/src/lib/tutor-application";

const fields: { name: keyof TutorProfileFields; label: string; private?: boolean }[] = [
  { name: "avatarUrl", label: "Avatar URL" },
  { name: "bio", label: "Bio" },
  { name: "introVideoUrl", label: "Introduction video URL" },
  { name: "identificationCardUrl", label: "Identification card URL", private: true },
  { name: "certificationUrl", label: "Teaching certification URL", private: true },
];

function ProfileValue({ name, value }: { name: keyof TutorProfileFields; value: string | null }) {
  if (!value) return <span className="text-zinc-500">Not provided</span>;
  if (name !== "bio" && /^https?:\/\//i.test(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="break-all underline">
        {value}
      </a>
    );
  }
  return <span className="whitespace-pre-wrap break-words">{value}</span>;
}

export function TutorProfileComparison({
  current,
  proposed,
}: {
  current: TutorProfileFields | null;
  proposed: TutorProfileFields;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-left text-sm">
        <caption className="mb-3 text-left text-zinc-500">
          {current
            ? "Compare the current approved profile with the submitted changes."
            : "Initial application — no approved Tutor profile exists yet."}
        </caption>
        <thead>
          <tr>
            <th className="w-1/4 p-3">Field</th>
            <th className="p-3">Current approved</th>
            <th className="p-3">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const changed = (current?.[field.name] ?? null) !== (proposed[field.name] ?? null);
            return (
              <tr
                key={field.name}
                className={
                  changed
                    ? "border-t border-black/[.12] bg-amber-500/10 dark:border-white/[.18]"
                    : "border-t border-black/[.12] dark:border-white/[.18]"
                }
              >
                <th className="p-3 align-top font-medium" scope="row">
                  {field.label}
                  {field.private && (
                    <span className="block text-xs text-zinc-500">
                      Private verification document
                    </span>
                  )}
                  {changed && (
                    <span className="block text-xs text-amber-800 dark:text-amber-300">
                      Changed
                    </span>
                  )}
                </th>
                <td className="p-3 align-top">
                  <ProfileValue name={field.name} value={current?.[field.name] ?? null} />
                </td>
                <td className="p-3 align-top">
                  <ProfileValue name={field.name} value={proposed[field.name]} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
