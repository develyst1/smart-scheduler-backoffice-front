// Who may open which page (SPEC-097 §4; the model of final-ui/src/shell/registry.ts). The menu, the page gate and each role's home are all drawn from this one table.
import { Banknote, BarChart3, Boxes, FileText, LayoutDashboard, PieChart, Tags, type LucideIcon } from "lucide-react";
import { isRole, type Role } from "@/types/app/roles";

export type Group = "REPORTS" | "REVENUE" | "ITEMS" | "SALARY";

export interface PageRule {
  /** first path segment is the route: "/revenue" covers "/revenue/…" too */
  href: string;
  label: string;
  group: Group;
  roles: Role[];
  /** pay or revenue: an admin never opens it (R0.2) */
  money?: true;
  /** in the sidebar menu (the rest are guarded but not listed — the old ops screens) */
  menu?: true;
  icon: LucideIcon;
}

export const PAGE_RULES: PageRule[] = [
  { href: "/dashboard", label: "งบกำไร–ขาดทุน", group: "REPORTS", roles: ["ceo"], money: true, menu: true, icon: LayoutDashboard },
  { href: "/revenue", label: "รายได้แยกตามกิจกรรม", group: "REVENUE", roles: ["ceo"], money: true, menu: true, icon: PieChart },
  { href: "/items", label: "รายการ (Items)", group: "ITEMS", roles: ["ceo", "admin"], menu: true, icon: Boxes },
  { href: "/tags", label: "แท็ก", group: "ITEMS", roles: ["ceo", "admin"], menu: true, icon: Tags },
  { href: "/salary", label: "Pay run (เงินเดือน)", group: "SALARY", roles: ["ceo"], money: true, menu: true, icon: Banknote }, // covers /salary/payrun + /salary/slip/[id] (TASK-866)
  { href: "/my-slip", label: "สลิปของฉัน", group: "SALARY", roles: ["coach"], money: true, menu: true, icon: FileText },
  { href: "/payroll", label: "ครู / Payroll", group: "SALARY", roles: ["ceo"], money: true, icon: BarChart3 },
  { href: "/ftpt-salary", label: "เงินเดือน FT/PT", group: "SALARY", roles: ["ceo"], money: true, icon: BarChart3 },
  { href: "/freelance-budgets", label: "งบ Freelance", group: "SALARY", roles: ["ceo"], money: true, icon: BarChart3 },
  { href: "/reports", label: "รายงาน", group: "REPORTS", roles: ["ceo"], money: true, icon: BarChart3 },
  { href: "/wallet", label: "Wallet", group: "ITEMS", roles: ["ceo", "admin"], icon: Boxes },
  { href: "/inventory", label: "Inventory", group: "ITEMS", roles: ["ceo", "admin"], icon: Boxes },
];

// The no-pay / no-revenue-for-admin rule, enforced where the table is defined: a page added later cannot slip past it.
for (const p of PAGE_RULES) {
  if (p.money && p.roles.includes("admin")) throw new Error(`PAGE_RULES: ${p.href} is a pay/revenue page and may not list "admin"`);
}

export const ruleFor = (pathname: string | null | undefined): PageRule | undefined =>
  PAGE_RULES.find((p) => pathname === p.href || pathname?.startsWith(`${p.href}/`));

/** An unlisted path is not a page the role may open — except the app root, which only redirects. */
export const canOpen = (role: Role, pathname: string | null | undefined): boolean => {
  const rule = ruleFor(pathname);
  return rule ? rule.roles.includes(role) : pathname === "/";
};

export interface MenuGroup {
  group: Group;
  items: PageRule[];
}

export const menuFor = (role: Role): MenuGroup[] => {
  const out: MenuGroup[] = [];
  for (const p of PAGE_RULES) {
    if (!p.menu || !p.roles.includes(role)) continue;
    const g = out.find((x) => x.group === p.group);
    if (g) g.items.push(p);
    else out.push({ group: p.group, items: [p] });
  }
  return out;
};

/** Where a signed-in role lands: its first menu page. */
export const homeFor = (role: Role): string => menuFor(role)[0]?.items[0]?.href ?? "/login";

export { isRole };
