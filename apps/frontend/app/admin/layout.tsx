import { AdminNavigation } from "@/src/components/admin-navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNavigation />
      {children}
    </>
  );
}
