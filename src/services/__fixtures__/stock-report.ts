// TASK-906 — fixture for the Stock Report Movement tab. ONLY `stock-report.service.ts` imports this file; no component does.
// 🟡 PENDING Sober Q1: the reader's shape. Names are invented products (CONVENTIONS §2.8). The wiring TASK swaps the service body and deletes this file.
import type { StockMovementRow, StockMovementType, StockSaleRow } from "@/types/app/stock-report";

let n = 0;
const m = (occurredOn: string, itemName: string, type: StockMovementType, qty: number, remainingAfter: number | null): StockMovementRow => {
  n += 1;
  return { id: `m${n}`, occurredOn, itemId: `i-${itemName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, itemName, type, qty, remainingAfter };
};

export const STOCK_MOVEMENTS_FIXTURE: StockMovementRow[] = [
  m("2026-10-02", "Miller inline skate — Seaworld", "STOCK_IN", 10, 10),
  m("2026-10-02", "Miller helmet — M", "STOCK_IN", 8, 8),
  m("2026-10-09", "Miller inline skate — Seaworld", "SALE", -1, 9),
  m("2026-10-15", "Miller helmet — M", "SALE", -2, 6),
  m("2026-10-31", "Miller helmet — M", "SALE", -1, 5),
  m("2026-11-01", "Miller inline skate — Seaworld", "FROM_DEMO", 2, 11),
  m("2026-11-02", "Miller helmet — M", "ADJUSTMENT", -1, 7),
  m("2026-11-03","Miller inline skate — Seaworld", "SALE", -3, 8),
  m("2026-11-05", "Miller helmet — M", "STOCK_IN", 6, 11),
  m("2026-11-09", "Miller helmet — M", "SALE", -1, 10),
  m("2026-11-09", "Miller inline skate — Seaworld", "SALE", -1, 7),
];

// ---- TASK-929: the Sales History tab (TASK-928's rows; no money). ----
let s = 0;
const sale = (occurredOn: string, name: string, qty: number, customer: string | null, payment: string | null): StockSaleRow => {
  s += 1;
  return { id: `l${s}`, saleId: `s${s}`, occurredOn, itemId: `i-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, code: "", name, qty, customer, payment, branch: "BRAVO" };
};

export const STOCK_SALES_FIXTURE: StockSaleRow[] = [
  sale("2026-10-09", "Miller inline skate — Seaworld", 1, "Khun Mali", "TRANSFER"),
  sale("2026-10-15", "Miller helmet — M", 2, null, "CASH"),
  sale("2026-10-31", "Miller helmet — M", 1, "Khun Ton", "CARD"),
  sale("2026-11-03", "Miller inline skate — Seaworld", 3, "Khun Mali", "CASH"),
  sale("2026-11-09", "Miller helmet — M", 1, null, null),
  sale("2026-11-09", "Miller inline skate — Seaworld", 1, "Khun Ton", "TRANSFER"),
];
