// TASK-925 / SPEC-103 §2–§4: the All Report API (BB `GET /v1/reports/{overview,courses,students}`, TASK-924). 🟡 DEFAULTS: what each page shows is Khwan's to name.
// Money (`*Minor`, integer satang) is OMITTED by the API for an admin — never zeroed — so every money field is optional and a screen shows it only when it is present.

export type ReportBranch = "BRAVO" | "OTHER";

/** §4 — the month overview. */
export interface ReportOverview {
  /** YYYY-MM */
  month: string;
  newStudents: number;
  activeStudents: number;
  /** SPEC-103 §7: first trials booked in the month, not cancelled. */
  trialsBooked: number;
  /** The ATTENDED ones of `trialsBooked`. */
  trials: number;
  /** ⊆ `trials`. */
  trialsConverted: number;
  coursesSold: number;
  vouchersSold: number;
  sessionsTaught: number;
  /** CEO only. */
  revenueMinor?: number;
  /** CEO only; ≤ 0. */
  refundsMinor?: number;
}
export interface OverviewParams {
  month: string;
  branch?: ReportBranch;
}

/** §2 — one row per activity × kind × size. */
export const COURSE_KINDS = ["PRIVATE", "DUO", "VOUCHER"] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];
export interface CourseRow {
  /** null for a VOUCHER row: a voucher has no subject (SPEC-103 §7). */
  subjectId: string | null;
  /** "Voucher" for a VOUCHER row. */
  subjectName: string;
  kind: CourseKind;
  /** The course's size (4 / 6 / 10) or the voucher's total hours. */
  size: number;
  sold: number;
  active: number;
  paused: number;
  ended: number;
  sessionsTaught: number;
  /** CEO only. */
  revenueMinor?: number;
}
export interface CourseTotals {
  sold: number;
  active: number;
  paused: number;
  ended: number;
  sessionsTaught: number;
  /** CEO only. */
  revenueMinor?: number;
  /** CEO only; present only when it is not 0 on the server. */
  unmatchedRevenueMinor?: number;
}
export interface CoursesResult {
  rows: CourseRow[];
  totals: CourseTotals;
  /** True when `to` is before today: "active" then uses today's sessions / hours left (SPEC-103 §7). */
  activeIsApprox: boolean;
}
export interface CoursesParams {
  from: string;
  to: string;
  branch?: ReportBranch;
}

/** §3 — the student register. No money on it. */
export type StudentStatusFilter = "ACTIVE" | "INACTIVE" | "ALL";
export interface StudentRow {
  studentId: string;
  name: string;
  nickname: string | null;
  gender: string | null;
  birthDate: string | null;
  age: number | null;
  parentName: string | null;
  parentPhone: string | null;
  province: string | null;
  activities: string[];
  status: "ACTIVE" | "INACTIVE";
  liveEntitlements: number;
  /** YYYY-MM-DD */
  firstSeenOn: string;
  lastAttendedOn: string | null;
}
export interface StudentsResult {
  rows: StudentRow[];
  counts: { active: number; inactive: number };
}
export interface StudentsParams {
  q?: string;
  status?: StudentStatusFilter;
  subjectId?: string;
}
