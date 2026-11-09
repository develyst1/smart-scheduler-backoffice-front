// TASK-905 — the Stock block's product read (Stock Out picker first). 💰 Money is whole satang (integers), printed as baht only at display.
// The shape is Sober's (TASK-905 § Answers, 2026-11-09): `GET /v1/stock/products` (ceo+admin, TASK-904) → this array, optional `?q=`. NO location (a single location now; CUSTOMER-ANSWERS QR3).
export type Satang = number;

export interface StockProduct {
  id: string;
  /** the Model code, e.g. "MIL-HEL-010" (the BB's `externalRef`) */
  code: string;
  name: string;
  category: string;
  priceSatang: Satang;
  /** the balance on hand (the BB's `remainingQty`) */
  quantity: number;
  /** the product's commission group and its per-unit amount; null / absent = no commission */
  /** the product carries its commission GROUP name only; the amount lives on the group (a future managed-groups task), so `amountSatang` is null for now (Sober, TASK-907 Q1b) */
  commissionGroup?: { name: string; amountSatang: Satang | null } | null;
  active: boolean;
}

/**
 * TASK-907 — the Product page's WRITE shape. PENDING Sober: only the LIST read is defined (TASK-904); `POST/PATCH /stock/products` is not, so writes run on the fixture seam only.
 * `openingQuantity` rides on create alone (the balance then starts from ONE opening movement, TASK-904 Q3); an edit never changes the balance.
 */
export interface StockProductInput {
  code: string;
  name: string;
  category: string;
  priceSatang: Satang;
  /** the group NAME (pick or type), or null for no commission — the write shape of TASK-911 */
  commissionGroup: string | null;
  active: boolean;
  openingQuantity?: number;
  /** the revenue category the product's sales post to: REQUIRED on create (the real route answers 400 without it — a product with none is born un-sellable); an edit may change it, never clear it */
  revenueCategoryId?: string;
}
/** One of the product form's revenue categories (`GET /v1/stock/revenue-categories`: active categories of the product types; names, no money). */
export interface RevenueCategory {
  id: string;
  type: string;
  name: string;
}
/** An edit changes everything except the Model code (its identity) and the balance. */
export type StockProductPatch = Partial<Omit<StockProductInput, "code" | "openingQuantity">>;

/** TASK-910 — `POST /v1/stock/out` (TASK-909): a cart of lines leaves stock and is recorded. One `idempotencyKey` per confirmed cart. No revenue / commission TOTALS anywhere in the response (R0). */
export interface StockOutLine {
  itemId: string;
  qty: number;
  unitPriceSatang: Satang;
  discountSatang?: Satang;
  /** typed per line, sent as given (lower OR raise) — no commission math in this layer */
  commissionSatang?: Satang;
}
/** How the sale was paid — REQUIRED: the revenue line's method is NOT NULL (DECISIONS row 21; 909 answers 400 METHOD_REQUIRED without it). The values are the front-office payment card's. */
export type StockPaymentMethod = "TRANSFER" | "CASH" | "CARD";
export interface StockOutRequest {
  idempotencyKey: string;
  method: StockPaymentMethod;
  /** YYYY-MM-DD */
  soldAt?: string;
  sellerRefs?: string[];
  lines: StockOutLine[];
}
export interface StockOutResult {
  saleId: string;
  movementsWritten: number;
  soldAt: string;
  /** true when the same key was sent before: nothing was written again, this is the first result */
  alreadyApplied?: boolean;
}
/** The 409 body: a line would drive a balance below 0 — the WHOLE sale is refused, nothing is sold. */
export interface NegativeBalanceBody {
  /** the app's standard error ENVELOPE (Sober): `error.code`, `error.message`, and the line's facts in `error.details` */
  error: { code: "NEGATIVE_BALANCE"; message: string; details: { model: string; name: string; resultingBalance: number } };
}
/** Someone who can be named as the seller (a `sellerRefs` entry is their id). 🟡 PENDING Sober: where this list comes from on the real side (909 only takes the refs). */
export interface Seller {
  id: string;
  name: string;
}

/** TASK-912 — `POST /v1/stock/in` (the BE stock-in write, folded into TASK-911): ONE receive = product + quantity + date, written as STOCK_IN movements. 🚫 NO cost, NO price (REQ-120 R3.2). */
export interface StockInRequest {
  idempotencyKey: string;
  /** YYYY-MM-DD (Bangkok) */
  receivedOn: string;
  lines: Array<{ itemId: string; qty: number }>;
}
export interface StockInResult {
  receiptId: string;
  movementsWritten: number;
  receivedOn: string;
  /** true when the same key was sent before: nothing was added again */
  alreadyApplied?: boolean;
}

/** TASK-913 (REQ-120 R3.7) — the Low Stock alert level per TYPE (a product's category): a whole number ≥ 0, or null = no alert for that type. The real store is a later BE task (fixture until then). */
export type LowStockThresholds = Record<string, number | null>;

/** One row of `GET /v1/stock/low-stock` → `{ items }`: an ACTIVE product whose balance is at or under the level of its category (exact name). No money. */
export interface LowStockRow {
  id: string;
  code: string;
  name: string;
  category: string;
  quantity: number;
  threshold: number;
  /** threshold − quantity (0 when exactly at the level) */
  under: number;
}

/** A row of the Stock Out cart STUB: the picked product and a quantity (the real cart — discount, buyer, commission — is a later TASK). */
export interface CartStubRow {
  product: StockProduct;
  quantity: number;
}
