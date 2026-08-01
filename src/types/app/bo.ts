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

// ── Revenue reports (SPEC-021 / TASK-065) ──
// Money arrives in satang and is **only formatted** here — never recomputed. Two places deriving money is
// two places that will eventually disagree.

export interface RevenueBucket {
  subjectId: string;
  name: string;
  amountMinor: number;
}

/**
 * Why some revenue has no sport (TASK-083). `VOUCHER` is **expected** — a voucher is generic hours and
 * genuinely has none. The other two are **faults**: a reference that no longer resolves, or revenue posted
 * against a product code the report doesn't recognise.
 */
export type UnattributedCode = "VOUCHER" | "UNRESOLVED_REF" | "UNKNOWN_CODE";

export interface UnattributedReasonRow {
  code: UnattributedCode;
  count: number;
  /** "3 vouchers" doesn't say whether to care; "3 vouchers, ฿9,000" does. */
  amountMinor: number;
}

export interface RevenueByActivity {
  month: string; // YYYY-MM
  totalMinor: number;
  buckets: RevenueBucket[];
  /**
   * ⚠️ Revenue that cannot belong to one sport. This is a **requirement, not an edge case**:
   * `buckets + unattributed.totalMinor` must reconcile to `totalMinor` on screen, or an executive reads a
   * tidy split that doesn't add up to the real month.
   */
  unattributed: {
    totalMinor: number;
    reasons: UnattributedReasonRow[];
  };
}

export interface CustomerSpend {
  studentId: string;
  name: string;
  totalSpendMinor: number;
  courses: number;
  vouchers: number;
  sessions: number;
}

export interface CustomerSpendReport {
  month: string;
  customers: CustomerSpend[];
}
