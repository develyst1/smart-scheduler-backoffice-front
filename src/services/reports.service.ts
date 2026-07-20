import { api } from "@/lib/api/client";
import type { PLReport } from "@/types/app/backoffice";

export async function getPLReport(params?: { from?: string; to?: string }): Promise<PLReport> {
  const { data } = await api.get<PLReport>("/v1/reports/pl", { params });
  return data;
}
