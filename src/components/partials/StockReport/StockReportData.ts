"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listStockBalances, listStockMovements, listStockSales } from "@/services/stock-report.service";
import type { Role } from "@/types/app/roles";
import type { StockMovementQuery, StockSalesQuery } from "@/types/app/stock-report";

// The role is part of the key: a Coach's (empty) answer must never be served to a CEO.
export const useStockMovements = (role: Role | null, q: StockMovementQuery, enabled: boolean) =>
  useQuery({ queryKey: ["stock-report", "movement", role, q], queryFn: () => listStockMovements(role as Role, q), enabled: role !== null && enabled, placeholderData: keepPreviousData });

// ---- TASK-929 ----
export const useStockSales = (role: Role | null, q: StockSalesQuery, enabled: boolean) =>
  useQuery({ queryKey: ["stock-report", "sales", role, q], queryFn: () => listStockSales(role as Role, q), enabled: role !== null && enabled, placeholderData: keepPreviousData });

export const useStockBalances = (role: Role | null, enabled: boolean) =>
  useQuery({ queryKey: ["stock-report", "balance", role], queryFn: () => listStockBalances(role as Role), enabled: role !== null && enabled });
