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
  /** "Freelance Hour" · "Extra Hour" · "OT" · "Merit" · "Other" …: the itemisation heading (R1.6) */
  kindLabel?: string;
  /** per-date text for an auto line; the typed reason for an Other ± line */
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

/** A coach-day with teaching minutes but no FL rate: the BE never pays it at 0 silently, it reports it (TASK-878). */
export interface RunWarning {
  teacherId: string;
  date: string; // YYYY-MM-DD
  classType: string; // private | duo | group | eca | camp
  problem: "no_fl_rate" | string;
}

export interface RunResult {
  created: number;
  refreshed: number;
  /** present only when a run changed auto lines (the BE omits it when nothing changed) */
  autoLines?: { inserted: number; updated: number; removed: number };
  /** present only when there is something to warn about */
  warnings?: RunWarning[];
}

export interface AddLineInput {
  amount: number; // signed integer satang, e.g. -50000 for −500.00 baht
  label: string;
}

// ---- TASK-882 / SPEC-102: the coach's own slip (§5-E1) and the admin-blind entry (§5-E2) ----

/** GET /salary/my-slip?year=&month= — the caller's OWN slip. A line's money key is `amountSatang` here (the CEO slip read says `amount`). */
export interface MySlipData {
  period: Pick<PayPeriod, "year" | "month" | "periodStart" | "periodEnd" | "lockAt" | "status">;
  teacherId: string;
  teacherName: string | null;
  baseAmount: Money;
  lines: { id: string; kind: LineKind; kindLabel?: string; label: string; amountSatang: Money }[];
  total: Money;
  status: SlipStatus;
}
/** No period or no slip for the month → `{ slip: null }` (200). */
export type MySlipResponse = { slip: null } | MySlipData;

/** The persons an admin may enter for. `isSystem` is the "No Teacher" placeholder (TASK-861): never offered. */
export interface EntryPerson {
  teacherId: string;
  name: string;
  isSystem?: boolean;
  meritEligible?: boolean;
}

export type EntryKind = "merit" | "other";

/** POST /salary/entries body. `amountSatang` is a signed integer for `other`, positive for `merit`; `reason` is required for `other`. */
export interface EntryInput {
  teacherId: string;
  year: number;
  month: number;
  kind: EntryKind;
  amountSatang: number;
  label?: string;
  reason?: string;
}

/** The 201: the created line ONLY (admin-blind). The FE keeps exactly these five keys and nothing else the response might carry. */
export interface EntryLine {
  lineId: string;
  kind: LineKind;
  kindLabel: string;
  label: string;
  amountSatang: number;
}

// ---- TASK-895 / TASK-868: the admin's Transportation trip card ----

/** GET /salary/transport/schools row. `distanceKm` is a distance, not pay. */
export interface TransportSchool {
  id: string;
  name: string;
  distanceKm: number;
  active: boolean;
}

/** POST /salary/transport/trips body. No `km` (the server defaults it) and never a vehicle (the server snapshots it from the profile). */
export interface TripInput {
  teacherId: string;
  date: string; // YYYY-MM-DD
  schoolId: string;
  roundTrip: boolean;
}

/** The admin's 201: only what the FE keeps. No amount, no vehicle. */
export interface TripEntry {
  id: string;
  date: string;
  schoolName: string;
  roundTrip: boolean;
  km: number;
}
