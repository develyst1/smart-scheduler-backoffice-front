// TASK-906 — Stock Report types. 🟡 PENDING Sober Q1: the BB movement reader's shape is [team-proposed] (`GET /api/v1/bo/stock/movements`); the wiring TASK changes the service body only.
// No money anywhere: the final UI says "No revenue amounts here", so `valueMinor` is deliberately absent.

export const STOCK_MOVEMENT_TYPES = ["SALE", "STOCK_IN", "ADJUSTMENT", "FROM_DEMO"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export interface StockMovementRow {
  id: string;
  /** Bangkok calendar date, YYYY-MM-DD. */
  occurredOn: string;
  itemId: string;
  itemName: string;
  type: StockMovementType;
  /** Signed: + in, − out. */
  qty: number;
  remainingAfter: number | null;
}

export interface StockMovementQuery {
  /** Inclusive, YYYY-MM-DD. */
  from: string;
  /** Inclusive, YYYY-MM-DD. */
  to: string;
  type?: StockMovementType;
}

export type StockReportTab = "sales" | "balance" | "movement";

// ---- TASK-929: Sales History + Balance tabs (TASK-928's `GET /v1/stock/sales`, TASK-904's `GET /v1/stock/products`). No money anywhere. ----

/** The raw payment enum of the sales read; the screen shows it as a word. */
export const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface StockSaleRow {
  id: string;
  saleId: string;
  /** Bangkok calendar date, YYYY-MM-DD. */
  occurredOn: string;
  itemId: string;
  /** the Model code ("" when the item has none) */
  code: string;
  name: string;
  qty: number;
  /** null = a sale with no buyer */
  customer: string | null;
  /** null = no payment method on the sale; an unknown value is shown as it came */
  payment: PaymentMethod | string | null;
  branch: string;
}

/** `GET /v1/stock/sales` answers the rows AND the distinct buyers of the window (the Customer select's list). */
export interface StockSalesResult {
  items: StockSaleRow[];
  customers: string[];
}

export interface StockSalesQuery {
  /** Inclusive, YYYY-MM-DD. */
  from: string;
  /** Inclusive, YYYY-MM-DD. */
  to: string;
  /** an exact buyer name; absent = everyone */
  customer?: string;
}

/** One line of the Balance tab: the product and its current quantity on hand (one location, so no Location). */
export interface StockBalanceRow {
  id: string;
  name: string;
  quantity: number;
}
