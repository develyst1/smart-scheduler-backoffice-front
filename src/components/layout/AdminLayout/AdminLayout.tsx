"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Card, Stack, Text, Title } from "@mantine/core";
import { Lock } from "lucide-react";
import Sidebar from "./Sidebar/Sidebar";
import Header from "./Header/Header";
import { clearToken } from "@/lib/auth";
import { useSession } from "@/context/RoleContext";
import { canOpen, homeFor, ruleFor } from "@/lib/roles/pages";
import { ROLE_LABEL, type Role } from "@/types/app/roles";

/** "This role cannot see this page" — drawn from the page's role list, never a blank page (final-ui NoAccess). */
function NoAccess({ role, label }: { role: Role; label: string }) {
  return (
    <Card padding="xl" ta="center" data-no-access>
      <Stack align="center" gap="sm">
        <Lock size={28} />
        <Title order={3}>บทบาทนี้ไม่เห็นหน้านี้</Title>
        <Text c="dimmed" maw={460}>
          บทบาท {ROLE_LABEL[role]} ไม่มีสิทธิ์เปิดหน้า {label}
        </Text>
        <Button component={Link} href={homeFor(role)} variant="light">
          กลับหน้าแรกของฉัน
        </Button>
      </Stack>
    </Card>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // desktop: ย่อ sidebar เหลือไอคอน · mobile: เปิด drawer ทับจอ
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, ready } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // A token with no valid role (or an unreadable one) is not a session: back to sign-in.
  useEffect(() => {
    if (ready && !user) {
      clearToken();
      router.replace("/login");
    }
  }, [ready, user, router]);

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role={user.role}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto bg-[#0d0e10] p-4 sm:p-6">
          {canOpen(user.role, pathname) ? children : <NoAccess role={user.role} label={ruleFor(pathname)?.label ?? "นี้"} />}
        </main>
      </div>
    </div>
  );
}
