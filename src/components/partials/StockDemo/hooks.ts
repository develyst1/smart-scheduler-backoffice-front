"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDemoSite, defectInDemo, deleteDemo, getDemoStock, listDemoMovements, moveDemo, orderDemoSites } from "@/services/stock-demo.service";
import type { Role } from "@/types/app/roles";
import type { DemoDefectInput, DemoDeleteInput, DemoMoveInput } from "@/types/app/stock-demo";

// The role is part of every key: a Coach's refusal must never be served to a CEO. A write refreshes the matrix and the history.
const ROOT = ["stock", "demo"] as const;

export const useDemoStock = (role: Role | null) => useQuery({ queryKey: [...ROOT, "stock", role], queryFn: () => getDemoStock(role), enabled: role !== null });
export const useDemoMovements = (role: Role | null) => useQuery({ queryKey: [...ROOT, "movements", role], queryFn: () => listDemoMovements(role), enabled: role !== null });

function useWrite<I, O>(role: Role | null, fn: (input: I, role: Role | null) => Promise<O>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: I) => fn(input, role), onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }) });
}

export const useMoveDemo = (role: Role | null) => useWrite<DemoMoveInput, unknown>(role, moveDemo);
export const useDefectIn = (role: Role | null) => useWrite<DemoDefectInput, unknown>(role, defectInDemo);
export const useDeleteDemo = (role: Role | null) => useWrite<DemoDeleteInput, unknown>(role, deleteDemo);
export const useAddSite = (role: Role | null) => useWrite<string, unknown>(role, addDemoSite);
export const useOrderSites = (role: Role | null) => useWrite<string[], unknown>(role, orderDemoSites);
