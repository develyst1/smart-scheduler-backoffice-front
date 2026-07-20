import { LayoutDashboard, Boxes, Wallet, Banknote } from "lucide-react";

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
  { key: "freelance-budgets", label: "งบครูฟรีแลนซ์", href: "/freelance-budgets", icon: Wallet },
  { key: "ftpt-salary", label: "เงินเดือนประจำ/พาร์ทไทม์", href: "/ftpt-salary", icon: Banknote },
];

export const APP_NAME = "Smart Backoffice";
