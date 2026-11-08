// Revenue ledger contract (SPEC-098 §3). Mirrors the API field for field.
// Money is integer satang (signed: a refund is negative). Dates are YYYY-MM-DD strings.

export type RevenueType = "COURSE" | "TRIAL" | "VOUCHER" | "ECA" | "SALES" | "FNB" | "RENT" | "OTHER";
export type RevenueLineType = RevenueType | "REFUND";
export type RevenueBranch = "BRAVO" | "OTHER";
export type RevenueMethod = "TRANSFER" | "CASH" | "CARD";

/** The 8 non-refund types, in SPEC-098 §2's order (also the order the API returns them). */
export const REVENUE_TYPES: readonly RevenueType[] = [
  "COURSE",
  "TRIAL",
  "VOUCHER",
  "ECA",
  "SALES",
  "FNB",
  "RENT",
  "OTHER",
];
export const REVENUE_BRANCHES: readonly RevenueBranch[] = ["BRAVO", "OTHER"];
export const REVENUE_METHODS: readonly RevenueMethod[] = ["TRANSFER", "CASH", "CARD"];

export interface RevenueCategory {
  id: string;
  type: RevenueType;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface RevenueLine {
  id: string;
  occurredOn: string;
  branch: RevenueBranch;
  type: RevenueLineType;
  categoryId: string | null;
  /** null for REFUND. */
  categoryName: string | null;
  productName: string;
  amountMinor: number;
  method: RevenueMethod;
  remark: string | null;
  source: string;
  createdAt: string;
}

export interface SummaryRow {
  type: RevenueType;
  amountMinor: number;
}

export interface SummaryBlock {
  /** All 8 non-refund types, always, in REVENUE_TYPES order. */
  rows: SummaryRow[];
  /** Sum of rows; refunds excluded. */
  totalMinor: number;
  /** Sum of REFUND lines (<= 0). */
  refundsMinor: number;
}

export interface RevenueSummary {
  date: string;
  today: SummaryBlock;
  mtd: SummaryBlock;
  ytd: SummaryBlock;
}

export interface ListCategoriesParams {
  type?: RevenueType;
  includeInactive?: boolean;
}

export interface CreateCategoryInput {
  type: RevenueType;
  name: string;
}

export interface CreateLineInput {
  occurredOn: string;
  branch: RevenueBranch;
  type: RevenueType;
  categoryId: string;
  productName?: string;
  amountMinor: number;
  method: RevenueMethod;
  remark?: string;
}

export interface ListLinesParams {
  from: string;
  to: string;
  branch?: RevenueBranch;
  type?: RevenueLineType;
  categoryId?: string;
}

export interface ListLinesResult {
  lines: RevenueLine[];
  /** Sum of the returned lines, refunds included. */
  totalMinor: number;
  /** Sum of the returned non-refund lines (SPEC-098 §3, added in review 1). The screen's "Total Revenue". */
  revenueMinor: number;
  /** Sum of the returned REFUND lines (<= 0). The screen's "Refund (Expense)" row when not 0. */
  refundsMinor: number;
}

export interface SummaryParams {
  date: string;
  branch?: RevenueBranch;
}
