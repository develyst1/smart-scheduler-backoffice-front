import { AdminLayout } from "@/components/layout/AdminLayout";

// Auth guard lands in a later wave; Wave 0 renders the shell directly.
export default async function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
