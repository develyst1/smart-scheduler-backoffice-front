"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRole } from "@/context/RoleContext";
import * as svc from "@/services/salary-reports.service";
import type { Role } from "@/types/app/roles";
import type { ReportPeriod } from "@/types/app/salary-reports";

const ROOT = ["salary-reports"] as const;

// Keyed by role: a role change is a different answer (CEO only; any other role gets nothing). No role yet ⇒ no call.
export const useReportPeriods = () => {
  const role = useRole();
  return useQuery({ queryKey: [...ROOT, role, "periods"], queryFn: () => svc.listReportPeriods(role as Role), enabled: role !== null });
};
export const useCoachNames = () => {
  const role = useRole();
  return useQuery({ queryKey: [...ROOT, role, "names"], queryFn: () => svc.listCoachNames(role as Role), enabled: role !== null });
};
export const useTeachingReport = (periodId: string | null) => {
  const role = useRole();
  return useQuery({ queryKey: [...ROOT, role, "teaching", periodId], queryFn: () => svc.getTeachingReport(role as Role, periodId as string), enabled: role !== null && periodId !== null });
};
export const usePayReport = (periodId: string | null) => {
  const role = useRole();
  return useQuery({ queryKey: [...ROOT, role, "pay", periodId], queryFn: () => svc.getPayReport(role as Role, periodId as string), enabled: role !== null && periodId !== null });
};

/** The period of a picked month, if the pay run for it exists. */
export const useMonthPeriod = (periods: ReportPeriod[] | undefined, year: number, month: number) =>
  useMemo(() => (periods ?? []).find((p) => p.year === year && p.month === month) ?? null, [periods, year, month]);
