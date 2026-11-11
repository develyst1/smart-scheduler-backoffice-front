"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";
import { APP_NAME, APP_SUB } from "../AdminLayout.config";
import { menuFor } from "@/lib/roles/pages";
import type { Role } from "@/types/app/roles";

interface Props {
  role: Role;
  /** desktop: collapsed to icons */
  collapsed: boolean;
  /** mobile: drawer open */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-orange-800 text-primary-foreground shadow-md shadow-primary/30">
        <Wallet size={20} />
      </span>
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">{APP_NAME}</p>
          <p className="text-xs text-default-400">{APP_SUB}</p>
        </div>
      )}
    </div>
  );
}

function NavList({
  role,
  collapsed,
  onNavigate,
}: {
  role: Role;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2" aria-label="Menu">
      {menuFor(role).map(({ group, items }) => (
        <div key={group} className="flex flex-col gap-1">
          {collapsed ? (
            <div className="my-2 border-t border-default-200" />
          ) : (
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wider text-default-400">{group}</p>
          )}
          {items.map((item) => {
        const Icon = item.icon;
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
              collapsed ? "justify-center" : ""
            } ${
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-default-600 hover:bg-default-100"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
            )}
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                active
                  ? "bg-primary/15 text-primary"
                  : "text-default-500 group-hover:text-default-600"
              }`}
            >
              <Icon size={18} />
            </span>
            {!collapsed && item.label}
          </Link>
        );
      })}
        </div>
      ))}
    </nav>
  );
}

export default function Sidebar({ role, collapsed, mobileOpen, onCloseMobile }: Props) {
  return (
    <>
      {/* ── Desktop: the sidebar in the layout, collapsible (hidden on small screens) ── */}
      <aside
        className={`hidden h-full shrink-0 flex-col border-r border-default-200 bg-content1 transition-[width] duration-200 lg:flex ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <Brand collapsed={collapsed} />
        <NavList role={role} collapsed={collapsed} />
        {!collapsed && (
          <div className="px-5 py-4 text-xs text-default-400">v0.1 · Back office team</div>
        )}
      </aside>

      {/* ── Mobile: a drawer over the page + a backdrop (small screens only) ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onCloseMobile}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-default-200 bg-content1 shadow-xl">
            <Brand collapsed={false} />
            <NavList role={role} collapsed={false} onNavigate={onCloseMobile} />
            <div className="px-5 py-4 text-xs text-default-400">v0.1 · Back office team</div>
          </aside>
        </div>
      )}
    </>
  );
}
