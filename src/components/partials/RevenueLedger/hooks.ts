"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/services/revenue-ledger.service";
import type { ListCategoriesParams, ListLinesParams, SummaryParams } from "@/types/app/revenue-ledger";

const ROOT = ["revenue-ledger"] as const;

export function useRevenueSummary(params: SummaryParams) {
  return useQuery({
    queryKey: [...ROOT, "summary", params],
    queryFn: () => svc.getSummary(params),
    placeholderData: keepPreviousData,
  });
}

export function useRevenueLines(params: ListLinesParams) {
  return useQuery({
    queryKey: [...ROOT, "lines", params],
    queryFn: () => svc.listLines(params),
    placeholderData: keepPreviousData,
  });
}

export function useRevenueCategories(params?: ListCategoriesParams, enabled = true) {
  return useQuery({
    queryKey: [...ROOT, "categories", params ?? {}],
    queryFn: () => svc.listCategories(params),
    enabled,
  });
}

export function useCreateRevenueCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: [...ROOT, "categories"] }),
  });
}

/** TASK-894: the refund pick list (server-side search). */
export function useRefundSources(q: string) {
  return useQuery({
    queryKey: [...ROOT, "refund-sources", q],
    queryFn: () => svc.listRefundSources(q),
    placeholderData: keepPreviousData,
  });
}

/** TASK-894: one refund. It changes the sources (refunded flag), the lines list and every summary block. */
export function useCreateRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createRefund,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...ROOT, "refund-sources"] });
      qc.invalidateQueries({ queryKey: [...ROOT, "lines"] });
      qc.invalidateQueries({ queryKey: [...ROOT, "summary"] });
    },
  });
}

/** TASK-891: one ECA school payment. A new line changes the history (the lines list) and every summary block. */
export function useCreateEcaPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createEcaPayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...ROOT, "lines"] });
      qc.invalidateQueries({ queryKey: [...ROOT, "summary"] });
    },
  });
}

export function useCreateRevenueLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createLine,
    // A new line changes the detail list and every summary block.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...ROOT, "lines"] });
      qc.invalidateQueries({ queryKey: [...ROOT, "summary"] });
    },
  });
}
