"use client";

import { usePathname, useRouter } from "next/navigation";
import { ActionIcon, Badge, Tooltip } from "@mantine/core";
import { LogOut, Menu, PanelLeft, PanelLeftClose } from "lucide-react";
import { APP_NAME } from "../AdminLayout.config";
import { clearToken } from "@/lib/auth";
import { useSession } from "@/context/RoleContext";
import { ruleFor } from "@/lib/roles/pages";
import { ROLE_LABEL } from "@/types/app/roles";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
}

export default function Header({ collapsed, onToggleCollapse, onOpenMobile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const current = ruleFor(pathname);
  const { user } = useSession();

  const logout = () => {
    clearToken();
    router.replace("/login");
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-default-200 bg-content1/80 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* mobile: เปิด drawer */}
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          className="lg:hidden"
          onClick={onOpenMobile}
          aria-label="เปิดเมนู"
        >
          <Menu size={20} />
        </ActionIcon>
        {/* desktop: ย่อ/ขยาย sidebar */}
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          className="hidden lg:inline-flex"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
        >
          {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </ActionIcon>
        <h1 className="truncate text-lg font-semibold tracking-tight">
          {current?.label ?? APP_NAME}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-sm">
        <span className="hidden text-default-500 sm:inline">{user?.username}</span>
        {user && (
          <Badge variant="light" color="orange" tt="none" aria-label="บทบาท">
            {ROLE_LABEL[user.role]}
          </Badge>
        )}
        <Tooltip label="ออกจากระบบ">
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={logout} aria-label="ออกจากระบบ">
            <LogOut size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
    </header>
  );
}
