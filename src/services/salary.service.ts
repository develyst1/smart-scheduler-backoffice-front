import { api } from "@/lib/api/client";
import type { AddLineInput, PayPeriod, PeriodOverview, RunResult, Slip, SlipLine } from "@/types/app/salary";

// SPEC-100 §5. `api` already ends in `/api`, so the paths start at `/v1/salary`. Bodies are the bare objects the SPEC lists.
const BASE = "/v1/salary";

export async function listPeriods(): Promise<PayPeriod[]> {
  const { data } = await api.get<PayPeriod[]>(`${BASE}/periods`);
  return data;
}

export async function createPeriod(input: { year: number; month: number }): Promise<PayPeriod> {
  const { data } = await api.post<PayPeriod>(`${BASE}/periods`, input);
  return data;
}

export async function runPeriod(periodId: string): Promise<RunResult> {
  const { data } = await api.post<RunResult>(`${BASE}/periods/${periodId}/run`);
  return data;
}

export async function getOverview(periodId: string): Promise<PeriodOverview> {
  const { data } = await api.get<PeriodOverview>(`${BASE}/periods/${periodId}`);
  return data;
}

export async function lockPeriod(periodId: string): Promise<PayPeriod> {
  const { data } = await api.post<PayPeriod>(`${BASE}/periods/${periodId}/lock`);
  return data;
}

export async function getSlip(slipId: string): Promise<Slip> {
  const { data } = await api.get<Slip>(`${BASE}/slips/${slipId}`);
  return data;
}

export async function addLine(slipId: string, input: AddLineInput): Promise<SlipLine> {
  const { data } = await api.post<SlipLine>(`${BASE}/slips/${slipId}/lines`, input);
  return data;
}

export async function removeLine(slipId: string, lineId: string): Promise<void> {
  await api.delete(`${BASE}/slips/${slipId}/lines/${lineId}`);
}

/** The period CSV. Fetched with the bearer token (an <a href> cannot send it), then saved from a blob. */
export async function exportPeriodCsv(periodId: string, filename: string): Promise<void> {
  const res = await api.get<Blob>(`${BASE}/periods/${periodId}/export`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
