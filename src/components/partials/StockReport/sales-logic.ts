import type { PaymentMethod } from "@/types/app/stock-report";

// TASK-929 — the small display rules of the Sales History tab, kept pure so they are unit-tested.

export const PAYMENT_WORD: Record<PaymentMethod, string> = { CASH: "Cash", TRANSFER: "Transfer", CARD: "Card" };
export const WALK_IN = "Walk-in";
export const ALL_CUSTOMERS = "ALL";

/** The Payment cell: the enum as a word; a value the map does not know is shown as it came; none = "—". */
export function paymentWord(payment: string | null): string {
  if (payment === null || payment === "") return "—";
  return PAYMENT_WORD[payment as PaymentMethod] ?? payment;
}

/** The Customer cell: a sale with no buyer is a "Walk-in" (Porter, 2026-11-09). */
export const customerLabel = (customer: string | null): string => (customer === null || customer.trim() === "" ? WALK_IN : customer);

/** The Customer select: "All" first, then the window's buyers (the read's `customers`, by name). */
export function customerOptions(customers: readonly string[]): { value: string; label: string }[] {
  return [{ value: ALL_CUSTOMERS, label: "All" }, ...[...customers].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c }))];
}
