// SPEC-100 §5: pay run + slip contract. CEO-only. Money crosses the wire as an integer in SATANG (1 baht = 100), both ways;
// the screens sum in satang and turn it into baht text only at display.

export type Money = number;
export type PeriodStatus = "open" | "locked";
export type SlipStatus = "draft" | "confirmed" | "locked";
export type LineKind = "base" | "other" | "extra_hour" | "ot" | "merit" | "bonus" | "commission" | "fl_pay" | "transport";
export type LineSource = "manual" | "auto";

export interface PayPeriod {
  id: string;
  year: number;
  month: number; // 1–12
  /** TASK-871: the pay range the month's slips cover, inclusive "YYYY-MM-DD" (R1.4, e.g. 30/9–30/10); null on rows made before it */
  periodStart?: string | null;
  periodEnd?: string | null;
  status: PeriodStatus;
  /** the auto-lock instant (12:00 on the last day of the month) */
  lockAt: string;
  lockedAt: string | null;
}

export interface SlipRow {
  id: string;
  teacherId: string;
  /** SPEC-100 gives only teacherId; the screens show the name when the BE sends one (asked in TASK-866 ## Questions) */
  teacherName?: string | null;
  baseAmount: Money;
  total: Money;
  status: SlipStatus;
}

export interface PeriodOverview {
  period: PayPeriod;
  slips: SlipRow[];
}

export interface SlipLine {
  id: string;
  kind: LineKind;
  label: string;
  /** signed */
  amount: Money;
  source: LineSource;
}

export interface Slip {
  id: string;
  period: PayPeriod;
  teacherId: string;
  teacherName?: string | null;
  baseAmount: Money;
  status: SlipStatus;
  lines: SlipLine[];
  total: Money;
}

export interface RunResult {
  created: number;
  refreshed: number;
}

export interface AddLineInput {
  amount: number; // signed integer satang, e.g. -50000 for −500.00 baht
  label: string;
}
