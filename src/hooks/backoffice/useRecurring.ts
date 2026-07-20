"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/services/recurring.service";
import type { RecurringCost } from "@/services/recurring.service";

// FT/PT salaries are ops recurring costs keyed by (externalSource='smart-scheduler',
// externalRef=teacherId). The list returns every effective-dated row (incl. history);
// the UI groups them per teacher.
export const RECURRING_SOURCE = "smart-scheduler";

const KEY = ["backoffice", "recurring-costs"] as const;

export function useRecurringCosts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => svc.listRecurringCosts({ externalSource: RECURRING_SOURCE }),
  });
}

export function useSetRecurringCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.setRecurringCost,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** The row currently in effect for a teacher = the open row (effectiveTo=null), else the
 *  newest by effectiveFrom (the list is already ordered effectiveFrom desc per teacher). */
export function currentOf(history: RecurringCost[]): RecurringCost {
  return history.find((r) => r.effectiveTo === null && r.active) ?? history[0];
}
