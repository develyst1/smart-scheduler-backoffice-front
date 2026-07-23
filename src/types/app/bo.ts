// REQ-006 / TASK-023 — the universal backoffice item model (bo.*). Everything the money
// system tracks is an "item" (direction × cadence, optional ceiling/remaining); quantity
// moves via signed movements. Amounts are integer minor units (satang).

export type Direction = "INCOME" | "EXPENSE";
export type Cadence = "VARIABLE" | "FIXED_MONTHLY" | "FIXED_DAILY" | "FIXED_QUARTERLY";

export interface BoItem {
  id: string;
  name: string;
  unit: string;
  direction: Direction;
  cadence: Cadence;
  ceilingQty: number | null;
  remainingQty: number | null;
  unitPriceMinor: number;
  ownerRef: string | null;
  externalSource: string | null;
  active: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoMovement {
  id: string;
  itemId: string;
  qty: number;
  remainingAfter: number | null;
  valueMinor: number;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

export interface TagValue {
  id: string;
  tagGroupId: string;
  label: string;
  color: string | null;
  active: boolean;
  sortOrder: number;
}

export interface TagGroup {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  values: TagValue[];
}

export interface PLItemRow {
  itemId: string;
  name: string;
  direction: Direction;
  cadence: string;
  valueMinor: number;
}

export interface BoPLReport {
  from: string;
  to: string;
  incomeMinor: number;
  expenseMinor: number;
  profitMinor: number;
  byDirection: { direction: Direction; valueMinor: number }[];
  byCadence: { direction: Direction; cadence: string; valueMinor: number }[];
  byItem: PLItemRow[];
}

export const DIRECTION_LABEL: Record<Direction, string> = {
  INCOME: "รายรับ",
  EXPENSE: "รายจ่าย",
};

export const CADENCE_LABEL: Record<Cadence, string> = {
  VARIABLE: "ผันแปร",
  FIXED_MONTHLY: "คงที่/เดือน",
  FIXED_DAILY: "คงที่/วัน",
  FIXED_QUARTERLY: "คงที่/ไตรมาส",
};

/** "฿1,234" — whole baht from satang. */
export const thb = (minor: number) =>
  "฿" + (minor / 100).toLocaleString("th-TH", { maximumFractionDigits: 0 });
