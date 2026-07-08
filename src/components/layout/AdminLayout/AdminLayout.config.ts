import { LayoutDashboard, Boxes, Wallet, Banknote, BarChart3 } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

// Backoffice nav (todo.md Wave 0). Routes exist as thin placeholders until each
// wave is built: Wave 1 inventory → 2 wallet → 3 payroll → 4 reports.
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
  { key: "inventory", label: "สต๊อกสินค้า", href: "/inventory", icon: Boxes },
  { key: "wallet", label: "Wallet นักเรียน", href: "/wallet", icon: Wallet },
  { key: "payroll", label: "ครู / Payroll", href: "/payroll", icon: Banknote },
  { key: "reports", label: "รายงาน", href: "/reports", icon: BarChart3 },
];

export const APP_NAME = "Smart Backoffice";
