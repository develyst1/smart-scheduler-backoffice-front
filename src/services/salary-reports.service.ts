// The data seam of the Salary Report page (TASK-923, REQ-120 R1.8). On the real API since TASK-922 (BB) was accepted.
// CEO only: any other role gets nothing (hidden, never masked). Money over HTTP is integer satang; the API names a teacher by id only,
// so the name is the FE's join with the people read (system rows such as "No Teacher" are not in it).
import { api } from "@/lib/api/client";
import { listPeriods } from "@/services/salary.service";
import type { Role } from "@/types/app/roles";
import type { PayReport, ReportKind, ReportPeriod, TeachingReport } from "@/types/app/salary-reports";

export const REPORTS_SOURCE: "fixture" | "api" = "api";

const BASE = "/v1/salary/reports";
const EMPTY_TEACHING: TeachingReport = {
  rows: [],
  totals: { minutesByClass: { private: 0, duo: 0, group: 0, eca: 0, camp: 0 }, weekdayMinutes: 0, weekendMinutes: 0, totalMinutes: 0, sessions: 0 },
};
const EMPTY_PAY: PayReport = {
  rows: [],
  totals: { baseSatang: 0, byKind: { fl_pay: 0, extra_hour: 0, ot: 0, merit: 0, bonus: 0, commission: 0, transport: 0, other: 0 }, totalSatang: 0 },
};

/** The pay months to pick from. */
export async function listReportPeriods(role: Role): Promise<ReportPeriod[]> {
  if (role !== "ceo") return [];
  return (await listPeriods()).map((p) => ({ id: p.id, year: p.year, month: p.month }));
}

/** teacherId → name (system rows such as "No Teacher" are not in it). */
export async function listCoachNames(role: Role): Promise<Record<string, string>> {
  if (role !== "ceo") return {};
  const { data } = await api.get<{ teacherId: string; name: string; isSystem?: boolean }[]>("/v1/salary/entries/people");
  return Object.fromEntries((data ?? []).filter((p) => !p.isSystem).map((p) => [p.teacherId, p.name]));
}

export async function getTeachingReport(role: Role, periodId: string): Promise<TeachingReport> {
  if (role !== "ceo") return structuredClone(EMPTY_TEACHING);
  const { data } = await api.get<TeachingReport>(`${BASE}/teaching`, { params: { periodId } });
  return data;
}

export async function getPayReport(role: Role, periodId: string): Promise<PayReport> {
  if (role !== "ceo") return structuredClone(EMPTY_PAY);
  const { data } = await api.get<PayReport>(`${BASE}/pay`, { params: { periodId } });
  return data;
}

/** The path (no host) of an Excel export. Pure, so a test can pin it. */
export const reportExcelPath = (kind: ReportKind) => `${BASE}/${kind}.xlsx`;
export const reportExcelParams = (periodId: string) => ({ periodId });
export const reportExcelName = (kind: ReportKind, year: number, month: number) => `salary-${kind}-${year}-${String(month).padStart(2, "0")}.xlsx`;

/** Fetched with the bearer token (an <a href> cannot send it), then saved from a blob — as the pay-run CSV is. */
export async function exportReportExcel(kind: ReportKind, periodId: string, filename: string): Promise<void> {
  const res = await api.get<Blob>(reportExcelPath(kind), { params: reportExcelParams(periodId), responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
