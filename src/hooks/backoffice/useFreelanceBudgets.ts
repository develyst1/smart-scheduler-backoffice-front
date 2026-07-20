"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/services/catalog.service";
import type { CatalogItem } from "@/types/app/backoffice";

// Freelance monthly budgets are ops EXPENSE catalog items tagged in metadata
// (SPEC-001). They live under a per-teacher item keyed by
// (externalSource='smart-scheduler', externalRef=teacherId); quantityOnHand is the
// remaining budget in satang, salePriceMinor is the hourly rate, reorderLevel is
// the near-cap warning threshold, and metadata carries the base monthly budget.
export const FREELANCE_SOURCE = "smart-scheduler";
export const FREELANCE_KIND = "FREELANCE_BUDGET";

const KEY = ["backoffice", "freelance-budgets"] as const;

/** Base monthly budget (satang) an item was created with — read from metadata. */
export function budgetMinorOf(item: CatalogItem): number {
  const v = (item.metadata as { monthlyBudgetMinor?: unknown } | null)?.monthlyBudgetMinor;
  return typeof v === "number" ? v : 0;
}

function isFreelanceBudget(item: CatalogItem): boolean {
  return (item.metadata as { kind?: unknown } | null)?.kind === FREELANCE_KIND;
}

export function useFreelanceBudgets() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const items = await svc.listItems({ externalSource: FREELANCE_SOURCE, itemType: "EXPENSE" });
      return items.filter(isFreelanceBudget);
    },
  });
}

export interface CreateBudgetInput {
  /** Display name of the teacher. */
  name: string;
  /** Scheduling teacherId — stored as externalRef. */
  teacherId: string;
  /** Base monthly budget in satang (also the initial remaining). */
  monthlyBudgetMinor: number;
  /** Hourly rate in satang. */
  rateMinor: number;
  /** Near-cap warning threshold in satang (reorderLevel), or null for none. */
  reorderLevelMinor: number | null;
}

export function useCreateFreelanceBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBudgetInput) => {
      const item = await svc.createItem({
        sku: `freelance-${input.teacherId}`,
        name: input.name,
        unit: "บาท",
        itemGroup: "SERVICE",
        itemType: "EXPENSE",
        salePriceMinor: input.rateMinor,
        trackStock: true,
        reorderLevel: input.reorderLevelMinor,
        externalRef: input.teacherId,
        externalSource: FREELANCE_SOURCE,
        metadata: { kind: FREELANCE_KIND, monthlyBudgetMinor: input.monthlyBudgetMinor },
      });
      // A fresh item starts at quantityOnHand=0 (would read as "capped"); seed the
      // remaining to the full budget with a P&L-neutral IN (amountMinor:0), reusing
      // the TOPUP convention (non-reversal IN is ignored by /reports/pl).
      if (input.monthlyBudgetMinor > 0) {
        await svc.applyMovement(item.id, {
          direction: "IN",
          quantity: input.monthlyBudgetMinor,
          amountMinor: 0,
          refType: "TOPUP",
          reason: "งบเริ่มต้น",
        });
      }
      return item;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateFreelanceBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: string; patch: svc.UpdateItemInput }) =>
      svc.updateItem(v.itemId, v.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTopUp() {
  const qc = useQueryClient();
  return useMutation({
    // amountSatang is added to the remaining budget; P&L-neutral (amountMinor:0).
    mutationFn: (v: { itemId: string; amountSatang: number }) =>
      svc.applyMovement(v.itemId, {
        direction: "IN",
        quantity: v.amountSatang,
        amountMinor: 0,
        refType: "TOPUP",
        reason: "เติมงบ (ปลดล็อก)",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["backoffice", "pl"] });
    },
  });
}
