import { CLASS_KEYS, PAY_KINDS, type ClassKey, type Named, type PayAmounts, type PayKind, type PayReport, type PayWireRow, type TeachingMinutes, type TeachingReport, type TeachingWireRow } from "@/types/app/salary-reports";

// Pure rules of the Salary Report page (TASK-923), so the screen only draws them.

/** minutes → hours, 2 decimals ("90" → "1.50"). The API sends minutes; hours are a print format. */
export const hoursText = (minutes: number): string => (minutes / 60).toFixed(2);

export const CLASS_LABEL: Record<ClassKey, string> = { private: "Private", duo: "Duo", group: "Group", eca: "ECA", camp: "Camp" };
/** The heads of the "Other income" group, in the order of the BB seam's kinds (labels as the pay slip's itemisation). */
export const PAY_KIND_LABEL: Record<PayKind, string> = {
  fl_pay: "Freelance Hour", extra_hour: "Extra Hour", ot: "OT", merit: "Merit", bonus: "Bonus", commission: "Commission", transport: "Transportation", other: "Other ±",
};

/** Keep the rows whose teacher has a name (so "No Teacher" and removed people never show) and put the name on them. */
export function joinNames<T extends { teacherId: string }>(rows: readonly T[], names: Record<string, string>): Named<T>[] {
  return rows.filter((r) => typeof names[r.teacherId] === "string" && names[r.teacherId] !== "").map((r) => ({ ...r, name: names[r.teacherId] }));
}

/** The totals row = Σ of the rows shown. */
export function sumTeaching(rows: readonly TeachingMinutes[]): TeachingMinutes {
  const minutesByClass = { private: 0, duo: 0, group: 0, eca: 0, camp: 0 } as Record<ClassKey, number>;
  let weekdayMinutes = 0, weekendMinutes = 0, totalMinutes = 0, sessions = 0;
  for (const r of rows) {
    for (const c of CLASS_KEYS) minutesByClass[c] += r.minutesByClass[c];
    weekdayMinutes += r.weekdayMinutes; weekendMinutes += r.weekendMinutes; totalMinutes += r.totalMinutes; sessions += r.sessions;
  }
  return { minutesByClass, weekdayMinutes, weekendMinutes, totalMinutes, sessions };
}

export function sumPay(rows: readonly PayAmounts[]): PayAmounts {
  const byKind = { fl_pay: 0, extra_hour: 0, ot: 0, merit: 0, bonus: 0, commission: 0, transport: 0, other: 0 } as Record<PayKind, number>;
  let baseSatang = 0, totalSatang = 0;
  for (const r of rows) {
    for (const k of PAY_KINDS) byKind[k] += r.byKind[k];
    baseSatang += r.baseSatang; totalSatang += r.totalSatang;
  }
  return { baseSatang, byKind, totalSatang };
}

export const shownTeaching = (rep: TeachingReport, names: Record<string, string>): Named<TeachingWireRow>[] => joinNames(rep.rows, names);
export const shownPay = (rep: PayReport, names: Record<string, string>): Named<PayWireRow>[] => joinNames(rep.rows, names);
