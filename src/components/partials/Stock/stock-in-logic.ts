import type { StockInRequest, StockProduct } from "@/types/app/stock";

// Pure rules of the Stock IN (receive) screen (TASK-912), so the screen only draws them.
// 🚫 NO cost, NO price, NO profit (REQ-120 R3.2): a receive is product + quantity + date, nothing else.

export interface ReceiveDraft {
  product: StockProduct | null;
  /** the quantity box's text */
  qty: string;
  /** YYYY-MM-DD, or null when the date box is empty */
  receivedOn: string | null;
}
export type ReceiveErrors = Partial<Record<"product" | "qty" | "date", true>>;

/** Any ACTIVE product can be received — including a sold-out one (that is the point of receiving). */
export const isReceivable = (p: Pick<StockProduct, "active">): boolean => p.active;

const isoDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** A whole number above 0 (digits only). */
export const parseReceiveQty = (text: string): number | null => (/^\d+$/.test(text.trim()) && Number(text) > 0 ? Number(text) : null);

/** The form → one line, or the boxes that are wrong (nothing is sent while any is). The date may not be after `today` (a delivery that has arrived has a date of today or earlier). */
export function validateReceive(d: ReceiveDraft, today: string): { ok: { itemId: string; qty: number; receivedOn: string } } | { errors: ReceiveErrors } {
  const errors: ReceiveErrors = {};
  if (!d.product || !isReceivable(d.product)) errors.product = true;
  const qty = parseReceiveQty(d.qty);
  if (qty === null) errors.qty = true;
  if (!d.receivedOn || !isoDate(d.receivedOn) || d.receivedOn > today) errors.date = true;
  if (Object.keys(errors).length > 0) return { errors };
  return { ok: { itemId: (d.product as StockProduct).id, qty: qty as number, receivedOn: d.receivedOn as string } };
}

/** The POST body of `POST /v1/stock/in`: exactly `idempotencyKey · receivedOn · lines[{ itemId, qty }]` — no price field anywhere. */
export const buildReceiveRequest = (line: { itemId: string; qty: number; receivedOn: string }, idempotencyKey: string): StockInRequest => ({
  idempotencyKey,
  receivedOn: line.receivedOn,
  lines: [{ itemId: line.itemId, qty: line.qty }],
});

/** «Now in stock: N» — what the balance will be after this receive (the box's quantity added to the balance shown). */
export const balanceAfter = (p: Pick<StockProduct, "quantity">, qtyText: string): number => p.quantity + (parseReceiveQty(qtyText) ?? 0);
