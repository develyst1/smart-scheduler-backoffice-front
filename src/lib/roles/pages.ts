// Who may open which page (SPEC-097 §4; the model of final-ui/src/shell/registry.ts). The menu, the page gate and each role's home are all drawn from this one table.
import { Banknote, BarChart3, BellRing, Boxes, CalendarDays, FileText, KeyRound, LayoutDashboard, PieChart, Package, PackagePlus, Presentation, Receipt, Settings, ShieldCheck, ShoppingCart, Tags, Upload, UserRound, Users, type LucideIcon } from "lucide-react";
import { isRole, type Role } from "@/types/app/roles";

export type Group = "REPORTS" | "REVENUE" | "ITEMS" | "SALARY" | "STOCK" | "NOTIFICATION" | "SETTING";

export interface PageRule {
  /** first path segment is the route: "/revenue" covers "/revenue/…" too */
  href: string;
  label: string;
  group: Group;
  roles: Role[];
  /** 🔻 TASK-933: the roles whose MENU lists this page, when that is narrower than `roles` (a page a role may open — by address — but is not offered). Default: `roles`. */
  menuRoles?: Role[];
  /** pay or revenue: an admin never opens it (R0.2) */
  money?: true;
  /** in the sidebar menu (the rest are guarded but not listed — the old ops screens) */
  menu?: true;
  icon: LucideIcon;
}

export const PAGE_RULES: PageRule[] = [
  { href: "/dashboard", label: "P&L", group: "REPORTS", roles: ["ceo"], money: true, menu: true, icon: LayoutDashboard },
  { href: "/revenue", label: "Revenue by activity", group: "REVENUE", roles: ["ceo"], money: true, menu: true, icon: PieChart },
  { href: "/items", label: "Items", group: "ITEMS", roles: ["ceo", "admin"], menu: true, icon: Boxes },
  { href: "/tags", label: "Tags", group: "ITEMS", roles: ["ceo", "admin"], menu: true, icon: Tags },
  // 🔻 TASK-907 (Team B, lent to Team A's Stock block): Product — the list, category tabs, add / edit (CEO + Admin). One row, first in STOCK (the final UI's order: Product, …, STOCK OUT).
  { href: "/stock/products", label: "Product", group: "STOCK", roles: ["ceo", "admin"], menu: true, icon: Package },
  // 🔻 TASK-912 (Team B, lent to Team A's Stock block): STOCK IN, a manual receive — product + quantity + date, no cost / price (CEO + Admin). One row.
  { href: "/stock/in", label: "STOCK IN", group: "STOCK", roles: ["ceo", "admin"], menu: true, icon: PackagePlus },
  // 🔻 TASK-913 (Team B, lent to Team A's Stock block): LOW STOCK, the products at / under their type's alert level + the editable level per type (CEO + Admin). One row.
  { href: "/stock/low", label: "Low Stock", group: "STOCK", roles: ["ceo", "admin"], menu: true, icon: BellRing },
  // 🔻 TASK-914 (Team B, lent to Team A): NOTIFICATION — the settings (who is told what, CEO only: an Admin never changes it) and the web feed (CEO + Admin). Fixtures until a backend store exists.
  { href: "/notify/settings", label: "Notification Setting", group: "NOTIFICATION", roles: ["ceo"], menu: true, icon: ShieldCheck },
  { href: "/notify/inbox", label: "Notification Alert", group: "NOTIFICATION", roles: ["ceo", "admin"], menu: true, icon: BellRing },
  // 🔻 TASK-931 (R0.1; final-ui «User Setting»): who can sign in — Admit a login · Deactivate · Reactivate. CEO ONLY (an admin or a coach never manages logins). Fixture until TASK-930's `/v1/users` is deployed.
  { href: "/users", label: "User Setting", group: "SETTING", roles: ["ceo"], menu: true, icon: KeyRound },
  // 🔻 TASK-905 / 🔻 TASK-910 (Team B, lent to Team A's Stock block): STOCK OUT, the sell page (CEO + Admin). One row; the page is the product picker + search, the cart (qty · discount · commission), the seller pick and Save.
  { href: "/stock/out", label: "STOCK OUT", group: "STOCK", roles: ["ceo", "admin"], menu: true, icon: ShoppingCart },
  // 🔻 TASK-906 (Team A's Stock block; final-ui registry): the Stock Report, CEO + Admin, no amounts on it. Shows sample data until TASK-904's reader is wired.
  { href: "/stock/reports", label: "Stock Report", group: "STOCK", roles: ["ceo", "admin"], menu: true, icon: Boxes },
  // Stock git-style import (BF half of TASK-904): upload → diff → confirm. CEO only. Shows fixture data until 904 is wired.
  { href: "/stock/import", label: "Stock import", group: "STOCK", roles: ["ceo"], menu: true, icon: Upload },
  // 🔻 TASK-918 (Team A's Stock block; final-ui registry): Stock Demo (R3.6), CEO + Admin. No money on it. Fixture until TASK-915's routes are wired.
  { href: "/stock/demo", label: "Stock Demo", group: "STOCK", roles: ["ceo", "admin"], menu: true, icon: Presentation },
  // TASK-862 (Team B; final-ui's registry): Employee (CEO · Admin — the Base salary column is the CEO's), its hidden profile page, Payment Setting and the Daily Training Report (CEO).
  // They MUST stay above the `/salary` row (first match wins — it is also what gives each page its title). `/salary/person` is guarded but not in the menu.
  { href: "/salary/people", label: "Employee", group: "SALARY", roles: ["ceo", "admin"], menu: true, icon: Users },
  { href: "/salary/person", label: "Employee Profile", group: "SALARY", roles: ["ceo", "admin"], icon: UserRound },
  { href: "/salary/settings", label: "Payment Setting", group: "SALARY", roles: ["ceo"], money: true, menu: true, icon: Settings },
  // TASK-866 / final-ui order (Employee · Payment Setting · Monthly Payment · … · Daily): an explicit pay-run row, above Daily, so the CEO's SALARY menu matches the final UI.
  { href: "/salary/payrun", label: "Pay run", group: "SALARY", roles: ["ceo"], money: true, menu: true, icon: Banknote },
  { href: "/salary/daily", label: "Daily Training Report", group: "SALARY", roles: ["ceo"], money: true, menu: true, icon: CalendarDays },
  // TASK-923 (R1.8): the month-end Salary Report (Teaching · Pay + Excel). CEO only; above the `/salary` row.
  { href: "/salary/reports", label: "Salary Report", group: "SALARY", roles: ["ceo"], money: true, menu: true, icon: BarChart3 },
  // TASK-882 (final-ui's registry): the coach's own slip and the admin-blind Entries. These MUST stay above the `/salary` row (first match wins).
  { href: "/salary/my-slip", label: "Payment Detail", group: "SALARY", roles: ["coach"], money: true, menu: true, icon: FileText },
  // 🔻 TASK-933 (D-150-1): Other Income is the ADMIN's menu item; the CEO may OPEN it (by address) and gets a pointer to the Pay run there, never the refusing form or the shell's «no access» card.
  { href: "/salary/entries", label: "Other Income", group: "SALARY", roles: ["admin", "ceo"], menuRoles: ["admin"], menu: true, icon: Receipt },
  { href: "/salary", label: "Pay run", group: "SALARY", roles: ["ceo"], money: true, icon: Banknote }, // covers /salary/slip/[id] and the bare /salary redirect (TASK-866); the menu item is the /salary/payrun row above
  { href: "/my-slip", label: "My slip", group: "SALARY", roles: ["coach"], money: true, icon: FileText }, // the Phase-1 placeholder: still guarded, no longer in the menu (TASK-882)
  { href: "/payroll", label: "Payroll", group: "SALARY", roles: ["ceo"], money: true, icon: BarChart3 },
  { href: "/ftpt-salary", label: "FT/PT salary", group: "SALARY", roles: ["ceo"], money: true, icon: BarChart3 },
  { href: "/freelance-budgets", label: "Freelance budget", group: "SALARY", roles: ["ceo"], money: true, icon: BarChart3 },
  // 🔻 TASK-925 (SPEC-103 §1): All Report — CEO + Admin. No `money` flag on purpose: the money rule lives in the API (a money key is ABSENT for an admin), so the screens show none.
  { href: "/reports", label: "All Report", group: "REPORTS", roles: ["ceo", "admin"], menu: true, icon: BarChart3 },
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
    if (!p.menu || !(p.menuRoles ?? p.roles).includes(role)) continue;
    const g = out.find((x) => x.group === p.group);
    if (g) g.items.push(p);
    else out.push({ group: p.group, items: [p] });
  }
  return out;
};

/** Where a signed-in role lands: its first menu page. */
export const homeFor = (role: Role): string => menuFor(role)[0]?.items[0]?.href ?? "/login";

export { isRole };
