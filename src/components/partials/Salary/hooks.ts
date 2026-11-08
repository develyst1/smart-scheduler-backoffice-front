"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/services/salary.service";
import type { AddLineInput } from "@/types/app/salary";

const ROOT = ["salary"] as const;

export function usePeriods() {
  return useQuery({ queryKey: [...ROOT, "periods"], queryFn: svc.listPeriods });
}

export function useOverview(periodId: string | null) {
  return useQuery({
    queryKey: [...ROOT, "overview", periodId],
    queryFn: () => svc.getOverview(periodId as string),
    enabled: periodId !== null,
  });
}

export function useSlip(slipId: string) {
  return useQuery({ queryKey: [...ROOT, "slip", slipId], queryFn: () => svc.getSlip(slipId) });
}

// A period change (create / run / lock) moves the list, the overview and every slip's status; a line change moves its slip and the overview totals.
export function useCreatePeriod() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: svc.createPeriod, onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }) });
}

export function useRunPeriod() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: svc.runPeriod, onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }) });
}

export function useLockPeriod() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: svc.lockPeriod, onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }) });
}

export function useAddLine(slipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddLineInput) => svc.addLine(slipId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useRemoveLine(slipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => svc.removeLine(slipId, lineId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useExportCsv() {
  return useMutation({ mutationFn: (v: { periodId: string; filename: string }) => svc.exportPeriodCsv(v.periodId, v.filename) });
}
