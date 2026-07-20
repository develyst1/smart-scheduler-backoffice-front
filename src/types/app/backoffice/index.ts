// Item-centric backoffice domain. Everything the money system tracks is an "item"
// with a group (what it is) + a type (how it books into the P&L). Mirrors the
// Finance API contract; amounts are integer minor units (satang).

import type { SemanticColor } from "@/lib/ui/colors";

export type ItemGroup = "PRODUCT" | "SERVICE";
export type ItemType = "INCOME" | "EXPENSE" | "FIXED_COST";
export type StockDirection = "IN" | "OUT" | "ADJUST";

export interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  itemGroup: ItemGroup;
  itemType: ItemType;
  salePriceMinor: number;
  trackStock: boolean;
  reorderLevel: number | null;
  externalRef: string | null;
  externalSource: string | null;
  quantityOnHand: number;
  active: boolean;
}

export interface StockMovement {
  id: string;
  itemId: string;
  direction: StockDirection;
  quantity: number;
  quantityAfter: number;
  amountMinor: number;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

export interface PLByItem {
  itemId: string;
  sku: string;
  name: string;
  itemGroup: ItemGroup;
  itemType: ItemType;
  amountMinor: number;
}

export interface PLReport {
  from: string;
  to: string;
  revenueMinor: number;
  costMinor: number;
  profitMinor: number;
  byType: { itemType: ItemType; amountMinor: number }[];
  byItem: PLByItem[];
}

// ── Labels + semantics (Thai UI copy) ──
export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  INCOME: "รายรับ",
  EXPENSE: "รายจ่าย",
  FIXED_COST: "ค่าใช้จ่ายคงที่",
};

export const ITEM_GROUP_LABEL: Record<ItemGroup, string> = {
  PRODUCT: "สินค้า",
  SERVICE: "บริการ",
};

export const ITEM_TYPE_COLOR: Record<ItemType, SemanticColor> = {
  INCOME: "success",
  EXPENSE: "danger",
  FIXED_COST: "warning",
};

export const DIRECTION_LABEL: Record<StockDirection, string> = {
  IN: "เข้า",
  OUT: "ออก",
  ADJUST: "ปรับ",
};

// ── Money format (minor units → THB) ──
/** "฿1,234" — whole baht, for headline figures. */
export const thb = (minor: number) =>
  "฿" + (minor / 100).toLocaleString("th-TH", { maximumFractionDigits: 0 });

/** "1,234.00" — two decimals, no symbol, for tables. */
export const baht2 = (minor: number) =>
  (minor / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Signed baht for a P&L line: revenue positive, cost negative. */
export const signedThb = (minor: number, type: ItemType) =>
  (type === "INCOME" ? "+" : "−") + thb(minor);
