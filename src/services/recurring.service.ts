// The only place that talks to the Finance API for effective-dated FT/PT salaries
// (recurring costs, SPEC-002 / TASK-005). Amounts are integer minor units (satang).
import { api } from "@/lib/api/client";

export type TeacherType = "FULL_TIME" | "PART_TIME";

export interface RecurringCost {
  id: string;
  externalRef: string | null; // teacherId
  itemId: string;
  label: string | null;
  amountMinor: number;
  effectiveFrom: string; // "YYYY-MM-DD" (first of month)
  effectiveTo: string | null; // null = open-ended (current)
  active: boolean;
  teacherType: string | null;
}

export interface SetRecurringCostInput {
  externalRef: string; // teacherId
  label?: string;
  amountMinor: number;
  effectiveFrom: string; // "YYYY-MM"
  teacherType?: TeacherType;
}

export async function listRecurringCosts(
  params?: { externalSource?: string; externalRef?: string },
): Promise<RecurringCost[]> {
  const { data } = await api.get<{ items: RecurringCost[] }>("/v1/recurring-costs", { params });
  return data.items;
}

export async function setRecurringCost(input: SetRecurringCostInput): Promise<RecurringCost> {
  const { data } = await api.post<RecurringCost>("/v1/recurring-costs", input);
  return data;
}
