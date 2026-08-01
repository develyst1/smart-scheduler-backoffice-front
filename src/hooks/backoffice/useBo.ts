"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/services/bo.service";
import type { ListItemsParams } from "@/services/bo.service";

const KEY = {
  items: (p?: ListItemsParams) => ["bo", "items", p ?? {}] as const,
  movements: (id: string) => ["bo", "movements", id] as const,
  tags: ["bo", "tag-groups"] as const,
  pl: (r: { from?: string; to?: string }) => ["bo", "pl", r] as const,
};

const invalidateItems = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["bo", "items"] });

export function useBoItems(params?: ListItemsParams) {
  return useQuery({ queryKey: KEY.items(params), queryFn: () => svc.listItems(params) });
}

export function useCreateBoItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: svc.createItem, onSuccess: () => invalidateItems(qc) });
}

export function useUpdateBoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; patch: svc.UpdateItemInput }) => svc.updateItem(v.id, v.patch),
    onSuccess: () => invalidateItems(qc),
  });
}

export function useApplyBoMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: string; input: svc.MovementInput }) =>
      svc.applyMovement(v.itemId, v.input),
    onSuccess: (_d, v) => {
      invalidateItems(qc);
      qc.invalidateQueries({ queryKey: KEY.movements(v.itemId) });
      qc.invalidateQueries({ queryKey: ["bo", "pl"] });
    },
  });
}

export function useSetItemTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: string; tagValueIds: string[] }) =>
      svc.setItemTags(v.itemId, v.tagValueIds),
    onSuccess: () => invalidateItems(qc),
  });
}

export function useBoPL(range: { from?: string; to?: string }) {
  return useQuery({ queryKey: KEY.pl(range), queryFn: () => svc.getPLReport(range) });
}

export function useTagGroups() {
  return useQuery({ queryKey: KEY.tags, queryFn: svc.listTagGroups });
}

export function useCreateTagGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createTagGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.tags }),
  });
}

export function useCreateTagValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createTagValue,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.tags }),
  });
}

// ── Revenue reports (SPEC-021 / TASK-065) ──
export function useRevenueByActivity(month: string) {
  return useQuery({
    queryKey: ["bo", "revenue-by-activity", month] as const,
    queryFn: () => svc.getRevenueByActivity(month),
  });
}

export function useCustomerSpend(month: string, q?: string) {
  return useQuery({
    queryKey: ["bo", "customer-spend", month, q ?? ""] as const,
    queryFn: () => svc.getCustomerSpend(month, q),
    placeholderData: keepPreviousData,
  });
}
