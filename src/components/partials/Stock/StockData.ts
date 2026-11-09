"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStockProduct, getLowStockThresholds, listLowStock, listRevenueCategories, listSellers, listStockProducts, receiveStock, sellStockOut, setLowStockThresholds, updateStockProduct } from "@/services/stock.service";
import type { Role } from "@/types/app/roles";
import type { LowStockThresholds, StockInRequest, StockOutRequest, StockProductInput, StockProductPatch } from "@/types/app/stock";

// The role is part of every key: a Coach's (empty) answer must never be served to a CEO.
/** What a SALE may pick: the active products (TASK-905). */
export const useStockProducts = (role: Role | null) => useQuery({ queryKey: ["stock", "products", role], queryFn: () => listStockProducts(role as Role), enabled: role !== null });

/** The Product page's list: every product, inactive ones too (TASK-907). */
export const useAllStockProducts = (role: Role | null) =>
  useQuery({ queryKey: ["stock", "products-all", role], queryFn: () => listStockProducts(role as Role, undefined, { includeInactive: true }), enabled: role !== null });

/** The product form's REVENUE CATEGORY list (the CEO's create / edit); an Admin gets none. */
export const useRevenueCategories = (role: Role | null) => useQuery({ queryKey: ["stock", "revenue-categories", role], queryFn: () => listRevenueCategories(role as Role), enabled: role !== null });

/** An add or an edit re-reads every stock list (the page's and the picker's). */
export function useCreateStockProduct(role: Role | null) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: StockProductInput) => createStockProduct(role as Role, input), onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }) });
}

export function useUpdateStockProduct(role: Role | null) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; patch: StockProductPatch }) => updateStockProduct(role as Role, v.id, v.patch), onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }) });
}

/** TASK-910 — who can be picked as a seller. */
export const useSellers = (role: Role | null) => useQuery({ queryKey: ["stock", "sellers", role], queryFn: () => listSellers(role as Role), enabled: role !== null });

/** TASK-910 — sell a cart. 🚫 No retry: a retried POST is the idempotency key's job, not the query client's. A sale re-reads every stock list (the balances are lower now). */
export function useSellStockOut(role: Role | null) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (req: StockOutRequest) => sellStockOut(role as Role, req), retry: false, onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }) });
}

/** TASK-912 — receive stock. 🚫 No retry (the idempotency key is the guard). A receive re-reads every stock list (the balances are higher now). */
export function useReceiveStock(role: Role | null) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (req: StockInRequest) => receiveStock(role as Role, req), retry: false, onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }) });
}

/** TASK-913 — the alert level per type, and saving it (the Low Stock list re-reads, so a changed level re-filters it). */
export const useLowStockList = (role: Role | null) => useQuery({ queryKey: ["stock", "low-list", role], queryFn: () => listLowStock(role as Role), enabled: role !== null });

export const useLowStockThresholds =(role: Role | null) => useQuery({ queryKey: ["stock", "low-thresholds", role], queryFn: () => getLowStockThresholds(role as Role), enabled: role !== null });

export function useSaveLowStockThresholds(role: Role | null) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (next: LowStockThresholds) => setLowStockThresholds(role as Role, next), retry: false, onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }) });
}
