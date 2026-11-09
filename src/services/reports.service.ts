import { api } from "@/lib/api/client";
import { USE_FAKE_REPORTS } from "@/components/partials/AllReport/config";
import type { PLReport } from "@/types/app/backoffice";
import type { CoursesParams, CoursesResult, OverviewParams, ReportOverview, StudentsParams, StudentsResult } from "@/types/app/reports";

export async function getPLReport(params?: { from?: string; to?: string }): Promise<PLReport> {
  const { data } = await api.get<PLReport>("/v1/reports/pl", { params });
  return data;
}

// TASK-925 / SPEC-103 §2–§4. `api` already ends in `/api`, so the paths start at `/v1/reports`.
const BASE = "/v1/reports";

// The fake is loaded only when the dev constant is on, so the delivered bundle never carries it.
const fake = () => import("@/components/partials/AllReport/fake");

/** §4 — the month overview. Revenue / refunds come back only for a CEO. */
export async function getOverview(params: OverviewParams): Promise<ReportOverview> {
  if (USE_FAKE_REPORTS) return (await fake()).fakeOverview(params);
  const { data } = await api.get<ReportOverview>(`${BASE}/overview`, { params });
  return data;
}

/** §2 — courses by type over [from, to] (inclusive). */
export async function getCourses(params: CoursesParams): Promise<CoursesResult> {
  if (USE_FAKE_REPORTS) return (await fake()).fakeCourses(params);
  const { data } = await api.get<CoursesResult>(`${BASE}/courses`, { params });
  return data;
}

/** §3 — the student register. Default status ACTIVE; no money. */
export async function getStudents(params: StudentsParams): Promise<StudentsResult> {
  if (USE_FAKE_REPORTS) return (await fake()).fakeStudents(params);
  const { data } = await api.get<StudentsResult>(`${BASE}/students`, { params });
  return data;
}
