import { bahtTextToSatang, satangToInput } from "./stock-product-logic";
import { isPickable } from "./stock-picker-logic";
import type { Satang, StockOutRequest, StockPaymentMethod, StockProduct } from "@/types/app/stock";

/** The payment methods a sale can state (TASK-910 change, DECISIONS row 21): Transfer is the default. Labels in English (the back office is English-only). */
export const PAYMENT_METHOD_OPTIONS: { value: StockPaymentMethod; label: string }[] = [
  { value: "TRANSFER", label: "Transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Credit card" },
];
export const DEFAULT_PAYMENT_METHOD: StockPaymentMethod = "TRANSFER";

// Pure rules of the Stock OUT sell screen (TASK-910), so the screen only draws them. 💰 Money is whole satang; text boxes are parsed, never multiplied as floats.
// 🔴 NO commission math: the commission box is editable (lower OR raise) and sent as typed — no default from a group rate, no split among sellers, no pool (TASK-909 / Sober).

/** A line of the sell cart. `discount` and `commission` are the TEXT in the boxes (parsed at confirm). */
export interface SellLine {
  product: StockProduct;
  qty: number;
  discount: string;
  commission: string;
}

/** Today in Bangkok, YYYY-MM-DD — the sale's `soldAt`. */
export const todayBkk = (now: Date = new Date()): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);

/** Pick a product: a new line of qty 1, or — the same product again — one more, never above the balance. A sold-out or inactive product is not added. */
export function addLine(cart: readonly SellLine[], product: StockProduct): SellLine[] {
  if (!isPickable(product)) return [...cart];
  const at = cart.findIndex((l) => l.product.id === product.id);
  if (at === -1) return [...cart, { product, qty: 1, discount: "", commission: "" }];
  return cart.map((l, i) => (i === at ? { ...l, qty: Math.min(l.qty + 1, product.quantity) } : l));
}

export const removeLine = (cart: readonly SellLine[], productId: string): SellLine[] => cart.filter((l) => l.product.id !== productId);

/** A whole quantity from 1 up to the balance (anything else is pulled back into that range). */
export const clampQty = (qty: number, balance: number): number => (Number.isFinite(qty) ? Math.max(1, Math.min(Math.trunc(qty), Math.max(balance, 1))) : 1);

export const setLine = (cart: readonly SellLine[], productId: string, patch: Partial<Pick<SellLine, "qty" | "discount" | "commission">>): SellLine[] =>
  cart.map((l) => (l.product.id === productId ? { ...l, ...patch, ...(patch.qty !== undefined ? { qty: clampQty(patch.qty, l.product.quantity) } : {}) } : l));

/** What a line box holds → whole satang; "" → "empty" (not sent); a number ≥ 0 with ≤ 2 decimals; anything else → "invalid". */
export function parseMoneyBox(text: string): "empty" | "invalid" | { satang: Satang } {
  if (text.trim() === "") return "empty";
  const s = bahtTextToSatang(text);
  return s === null ? "invalid" : { satang: s };
}

export const lineGrossSatang = (l: SellLine): Satang => l.qty * l.product.priceSatang;

export interface LineCheck {
  discountSatang?: Satang;
  commissionSatang?: Satang;
  /** the boxes that are wrong */
  errors: Partial<Record<"discount" | "commission", true>>;
  /** qty × price − discount (never below 0); when the discount is wrong the discount counts as 0 */
  totalSatang: Satang;
}

/** One line: the discount may not exceed qty × price; the commission is any number ≥ 0 (editable lower or raise — no rule beyond its shape). */
export function checkLine(l: SellLine): LineCheck {
  const errors: LineCheck["errors"] = {};
  const d = parseMoneyBox(l.discount);
  const c = parseMoneyBox(l.commission);
  const gross = lineGrossSatang(l);
  let discountSatang: Satang | undefined;
  if (d === "invalid" || (d !== "empty" && d.satang > gross)) errors.discount = true;
  else if (d !== "empty") discountSatang = d.satang;
  let commissionSatang: Satang | undefined;
  if (c === "invalid") errors.commission = true;
  else if (c !== "empty") commissionSatang = c.satang;
  return { ...(discountSatang !== undefined ? { discountSatang } : {}), ...(commissionSatang !== undefined ? { commissionSatang } : {}), errors, totalSatang: gross - (discountSatang ?? 0) };
}

/** The sum of the lines — shown to the CEO only (R0: an Admin never sees a revenue total). */
export const cartTotalSatang = (cart: readonly SellLine[]): Satang => cart.reduce((sum, l) => sum + checkLine(l).totalSatang, 0);

export const cartIsValid = (cart: readonly SellLine[]): boolean => cart.length > 0 && cart.every((l) => Object.keys(checkLine(l).errors).length === 0);

/** The POST body of `POST /v1/stock/out` (TASK-909): one key per confirmed cart; an empty discount / commission box is simply not sent. */
export function buildSellRequest(cart: readonly SellLine[], sellerRefs: readonly string[], idempotencyKey: string, method: StockPaymentMethod, now: Date = new Date()): StockOutRequest {
  return {
    idempotencyKey,
    method,
    soldAt: todayBkk(now),
    ...(sellerRefs.length > 0 ? { sellerRefs: [...sellerRefs] } : {}),
    lines: cart.map((l) => {
      const c = checkLine(l);
      return {
        itemId: l.product.id,
        qty: l.qty,
        unitPriceSatang: l.product.priceSatang,
        ...(c.discountSatang !== undefined ? { discountSatang: c.discountSatang } : {}),
        ...(c.commissionSatang !== undefined ? { commissionSatang: c.commissionSatang } : {}),
      };
    }),
  };
}

export { satangToInput };

/**
 * One idempotency key per confirmed cart: `get()` mints it on the first press and returns the SAME key for a second press of the same cart (a double click, a retry after an error),
 * so the server cannot sell twice; `reset()` is called on any edit (a different cart) and after a success.
 */
export function createKeyKeeper(mint: () => string): { get: () => string; reset: () => void } {
  let key: string | null = null;
  return {
    get: () => (key ??= mint()),
    reset: () => {
      key = null;
    },
  };
}
