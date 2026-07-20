import { LayoutDashboard, Boxes } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

// Item-centric backoffice: a P&L dashboard + one catalog of typed items (product /
// service × income / expense / fixed-cost). Wallet/payroll are set aside for now.
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "งบกำไร–ขาดทุน", href: "/dashboard", icon: LayoutDashboard },
  { key: "items", label: "รายการ (Items)", href: "/items", icon: Boxes },
];

export const APP_NAME = "Smart Backoffice";
