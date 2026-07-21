"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ActionIcon, Tooltip } from "@mantine/core";
import { LogOut, Menu, PanelLeft, PanelLeftClose } from "lucide-react";
import { NAV_ITEMS, APP_NAME } from "../AdminLayout.config";
import { clearToken, getUser } from "@/lib/auth";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
}

export default function Header({ collapsed, onToggleCollapse, onOpenMobile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const current = NAV_ITEMS.find((i) => pathname?.startsWith(i.href));

  // Read after mount so SSR (no cookie) and client render agree.
  const [name, setName] = useState("แอดมิน");
  useEffect(() => {
    setName(getUser() ?? "แอดมิน");
  }, []);

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
        <span className="hidden text-default-500 sm:inline">{name}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-green-800 text-xs font-semibold text-primary-foreground ring-2 ring-primary/20">
          AD
        </span>
        <Tooltip label="ออกจากระบบ">
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={logout} aria-label="ออกจากระบบ">
            <LogOut size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
    </header>
  );
}
