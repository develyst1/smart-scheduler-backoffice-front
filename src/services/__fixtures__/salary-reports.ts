// TASK-923 — typed sample data in the shape of TASK-922's API. Since TASK-922 was accepted the service reads the real API; ONLY `salary-923.test.tsx` imports this file.
// Names are invented. `sys-none` is the "No Teacher" system row: it is in the data, and the screen must never show it.
import type { PayReport, ReportPeriod, TeachingReport } from "@/types/app/salary-reports";

export const REPORT_PERIODS_FIXTURE: ReportPeriod[] = [
  { id: "per-2026-11", year: 2026, month: 11 },
  { id: "per-2026-10", year: 2026, month: 10 },
  { id: "per-2026-09", year: 2026, month: 9 },
];

/** teacherId → name, as the people read gives it (system rows are not in it). */
export const REPORT_NAMES_FIXTURE: Record<string, string> = { t1: "Pete", t2: "May", t3: "Ton" };

const m = (private_: number, duo: number, group: number, eca: number, camp: number) => ({ private: private_, duo, group, eca, camp });

export const TEACHING_FIXTURE: TeachingReport = {
  rows: [
    { teacherId: "t1", role: "Full-time", minutesByClass: m(600, 120, 300, 0, 0), weekdayMinutes: 720, weekendMinutes: 300, totalMinutes: 1020, sessions: 17 },
    { teacherId: "t2", role: "Full-time", minutesByClass: m(300, 0, 180, 120, 480), weekdayMinutes: 600, weekendMinutes: 480, totalMinutes: 1080, sessions: 14 },
    { teacherId: "t3", role: "Part-time + Freelance", minutesByClass: m(180, 60, 0, 0, 0), weekdayMinutes: 90, weekendMinutes: 150, totalMinutes: 240, sessions: 4 },
    { teacherId: "sys-none", role: "System", minutesByClass: m(60, 0, 0, 0, 0), weekdayMinutes: 60, weekendMinutes: 0, totalMinutes: 60, sessions: 1 },
  ],
  totals: { minutesByClass: m(1140, 180, 480, 120, 480), weekdayMinutes: 1470, weekendMinutes: 930, totalMinutes: 2400, sessions: 36 },
};

const k = (fl: number, eh: number, ot: number, merit: number, bonus: number, com: number, tr: number, other: number) => ({
  fl_pay: fl, extra_hour: eh, ot, merit, bonus, commission: com, transport: tr, other,
});

export const PAY_FIXTURE: PayReport = {
  rows: [
    { teacherId: "t1", slipStatus: "confirmed", baseSatang: 2500000, byKind: k(0, 0, 90000, 100000, 20000, 0, 0, -15000), totalSatang: 2695000 },
    { teacherId: "t2", slipStatus: "draft", baseSatang: 2200000, byKind: k(0, 70000, 0, 0, 0, 12000, 0, 0), totalSatang: 2282000 },
    { teacherId: "t3", slipStatus: "draft", baseSatang: 1500000, byKind: k(420000, 0, 0, 0, 0, 0, 14400, 0), totalSatang: 1934400 },
  ],
  totals: { baseSatang: 6200000, byKind: k(420000, 70000, 90000, 100000, 20000, 12000, 14400, -15000), totalSatang: 6911400 },
};
