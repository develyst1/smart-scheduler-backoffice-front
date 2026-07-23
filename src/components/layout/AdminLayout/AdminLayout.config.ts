import { LayoutDashboard, Boxes, Tags } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

// Rebuilt backoffice (REQ-006): a P&L dashboard + one universal Items catalog (direction ×
// cadence, ceiling/remaining) + tags. The old ops screens (Freelance Budgets / FT-PT Salary)
// are retired — everything is now an item.
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "งบกำไร–ขาดทุน", href: "/dashboard", icon: LayoutDashboard },
  { key: "items", label: "รายการ (Items)", href: "/items", icon: Boxes },
  { key: "tags", label: "แท็ก", href: "/tags", icon: Tags },
];

export const APP_NAME = "Smart Backoffice";
