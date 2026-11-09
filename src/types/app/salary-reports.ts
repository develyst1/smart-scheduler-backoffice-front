// TASK-923 (REQ-120 R1.8) — the two month-end Salary Reports (CEO only), on the wire shape of TASK-922. Money is integer satang; durations are whole minutes
// (the screen prints hours = minutes / 60, 2 decimals). The API names a teacher by id ONLY: the name is the FE's join (never "No Teacher").
import type { SlipStatus } from "./salary";

export const CLASS_KEYS = ["private", "duo", "group", "eca", "camp"] as const;
export type ClassKey = (typeof CLASS_KEYS)[number];

export const PAY_KINDS = ["fl_pay", "extra_hour", "ot", "merit", "bonus", "commission", "transport", "other"] as const;
export type PayKind = (typeof PAY_KINDS)[number];

export interface TeachingMinutes {
  minutesByClass: Record<ClassKey, number>;
  weekdayMinutes: number;
  weekendMinutes: number;
  totalMinutes: number;
  sessions: number;
}
export interface TeachingWireRow extends TeachingMinutes {
  teacherId: string;
  role: string;
}
export interface TeachingReport {
  rows: TeachingWireRow[];
  totals: TeachingMinutes;
}

export interface PayAmounts {
  baseSatang: number;
  byKind: Record<PayKind, number>;
  totalSatang: number;
}
export interface PayWireRow extends PayAmounts {
  teacherId: string;
  slipStatus: SlipStatus;
}
export interface PayReport {
  rows: PayWireRow[];
  totals: PayAmounts;
}

/** A row once its name is joined in (rows with no name — "No Teacher", a removed person — are left out). */
export type Named<T> = T & { name: string };
export type ReportKind = "teaching" | "pay";
export interface ReportPeriod {
  id: string;
  year: number;
  month: number;
}
