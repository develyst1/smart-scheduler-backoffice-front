// Dev-only fake for SPEC-103 §2–§4 (see config.ts). Invented activities and students (CONVENTIONS §2.8); in-memory, loaded only when USE_FAKE_REPORTS is true.
// `fakeAs.role` stands in for the token: for "admin" every money key is OMITTED, exactly as the API does.
import type {
  CourseKind,
  CourseRow,
  CoursesParams,
  CoursesResult,
  CourseTotals,
  OverviewParams,
  ReportOverview,
  StudentRow,
  StudentsParams,
  StudentsResult,
} from "@/types/app/reports";

export const fakeAs: { role: "ceo" | "admin"; mode: "ok" | "empty" | "error" } = { role: "ceo", mode: "ok" };

// A browser run can pick the role / state without a rebuild: `localStorage["fake-reports"] = '{"role":"admin","mode":"empty"}'` (screenshots only; bun tests have no window).
const guard = () => {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("fake-reports") : null;
    if (raw) Object.assign(fakeAs, JSON.parse(raw));
  } catch {
    /* no storage: keep the defaults */
  }
  if (fakeAs.mode === "error") throw new Error("The report could not be loaded");
};

const OVERVIEWS: Record<string, Omit<ReportOverview, "month">> = {
  "2026-11": { newStudents: 14, activeStudents: 212, trialsBooked: 34, trials: 31, trialsConverted: 12, coursesSold: 46, vouchersSold: 9, sessionsTaught: 388, revenueMinor: 14_820_000, refundsMinor: -350_000 },
  "2026-10": { newStudents: 19, activeStudents: 205, trialsBooked: 41, trials: 38, trialsConverted: 17, coursesSold: 52, vouchersSold: 7, sessionsTaught: 421, revenueMinor: 16_105_000, refundsMinor: 0 },
};
const ZERO: Omit<ReportOverview, "month"> = { newStudents: 0, activeStudents: 0, trialsBooked: 0, trials: 0, trialsConverted: 0, coursesSold: 0, vouchersSold: 0, sessionsTaught: 0, revenueMinor: 0, refundsMinor: 0 };

export async function fakeOverview({ month }: OverviewParams): Promise<ReportOverview> {
  guard();
  const base = fakeAs.mode === "empty" ? ZERO : (OVERVIEWS[month] ?? ZERO);
  const { revenueMinor, refundsMinor, ...rest } = base;
  return { month, ...rest, ...(fakeAs.role === "ceo" ? { revenueMinor, refundsMinor } : {}) };
}

const c = (subjectName: string, kind: CourseKind, size: number, sold: number, active: number, paused: number, ended: number, sessionsTaught: number, revenueMinor: number): CourseRow => ({
  subjectId: `s-${subjectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  subjectName,
  kind,
  size,
  sold,
  active,
  paused,
  ended,
  sessionsTaught,
  revenueMinor,
});
const COURSE_ROWS: CourseRow[] = [
  c("Inline skating", "PRIVATE", 4, 12, 20, 2, 5, 96, 1_440_000),
  c("Inline skating", "PRIVATE", 10, 8, 31, 3, 4, 140, 3_120_000),
  c("Inline skating", "DUO", 10, 5, 12, 1, 2, 64, 2_250_000),
  c("Skateboard", "PRIVATE", 6, 7, 14, 1, 3, 58, 1_260_000),
  // SPEC-103 §7: a voucher has no subject, is never paused, and is per size only.
  { ...c("Voucher", "VOUCHER", 10, 2, 4, 0, 0, 9, 300_000), subjectId: null },
  { ...c("Voucher", "VOUCHER", 20, 3, 6, 0, 1, 22, 540_000), subjectId: null },
];

export async function fakeCourses({ from, to }: CoursesParams): Promise<CoursesResult> {
  guard();
  const rows = fakeAs.mode === "empty" || from > to ? [] : COURSE_ROWS.map((r) => ({ ...r }));
  const sum = (k: "sold" | "active" | "paused" | "ended" | "sessionsTaught") => rows.reduce((s, r) => s + r[k], 0);
  const ceo = fakeAs.role === "ceo";
  const totals: CourseTotals = { sold: sum("sold"), active: sum("active"), paused: sum("paused"), ended: sum("ended"), sessionsTaught: sum("sessionsTaught") };
  if (ceo) {
    totals.revenueMinor = rows.reduce((s, r) => s + (r.revenueMinor ?? 0), 0);
    if (rows.length > 0) totals.unmatchedRevenueMinor = 180_000;
  } else {
    for (const r of rows) delete r.revenueMinor;
  }
  // `activeIsApprox`: true when `to` is before today (sessions left are today's running count).
  return { rows, totals, activeIsApprox: to < new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()) };
}

const st = (n: number, name: string, nickname: string | null, age: number, gender: string, parentName: string, parentPhone: string, province: string, activities: string[], status: "ACTIVE" | "INACTIVE", live: number, first: string, last: string | null): StudentRow => ({
  studentId: `st${n}`,
  name,
  nickname,
  gender,
  birthDate: null,
  age,
  parentName,
  parentPhone,
  province,
  activities,
  status,
  liveEntitlements: live,
  firstSeenOn: first,
  lastAttendedOn: last,
});
const STUDENTS: StudentRow[] = [
  st(1, "Alpha Test", "Al", 8, "F", "Parent One", "0810000001", "Bangkok", ["Inline skating"], "ACTIVE", 1, "2026-03-04", "2026-11-08"),
  st(2, "Bravo Test", null, 11, "M", "Parent Two", "0810000002", "Nonthaburi", ["Inline skating", "Skateboard"], "ACTIVE", 2, "2026-01-12", "2026-11-05"),
  st(3, "Charlie Test", "Chip", 6, "M", "Parent Three", "0810000003", "Bangkok", ["Skateboard"], "INACTIVE", 0, "2025-09-20", "2026-08-30"),
  st(4, "=Delta Test", "D", 9, "F", "Parent Four", "0810000004", "Pathum Thani", ["Inline skating"], "INACTIVE", 0, "2025-06-02", null),
];

export async function fakeStudents({ q, status = "ACTIVE", subjectId }: StudentsParams): Promise<StudentsResult> {
  guard();
  const all = fakeAs.mode === "empty" ? [] : STUDENTS;
  const needle = (q ?? "").trim().toLowerCase();
  const matches = (s: StudentRow) =>
    (needle === "" || [s.name, s.nickname ?? "", s.parentPhone ?? ""].some((v) => v.toLowerCase().includes(needle))) &&
    (subjectId === undefined || s.activities.some((a) => `s-${a.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` === subjectId));
  const scoped = all.filter(matches);
  const rows = scoped.filter((s) => status === "ALL" || s.status === status).sort((a, b) => a.name.localeCompare(b.name)).map((s) => ({ ...s }));
  return { rows, counts: { active: scoped.filter((s) => s.status === "ACTIVE").length, inactive: scoped.filter((s) => s.status === "INACTIVE").length } };
}
