import { AdminLayout } from "@/components/layout/AdminLayout";
import { RoleProvider } from "@/context/RoleContext";

// The role comes from the signed-in token (RoleProvider); AdminLayout draws the menu and gates the page by it.
export default async function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleProvider>
      <AdminLayout>{children}</AdminLayout>
    </RoleProvider>
  );
}
