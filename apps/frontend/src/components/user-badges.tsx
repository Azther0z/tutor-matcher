import type { ManagedUser } from "@/src/lib/admin-users-api";
import { badge, badgeColors } from "@/src/lib/admin-users-style";

export function UserBadges({ user }: { user: ManagedUser }) {
  return (
    <span className="flex flex-wrap gap-2">
      <span className={`${badge} ${badgeColors.role}`}>{user.isTutor ? "Tutor" : "Student"}</span>
      {user.isAdmin && <span className={`${badge} ${badgeColors.admin}`}>Admin</span>}
      {user.restriction && (
        <span className={`${badge} ${badgeColors[user.restriction.type]}`}>
          {user.restriction.type === "BAN" ? "Banned" : "Suspended"}
        </span>
      )}
    </span>
  );
}
