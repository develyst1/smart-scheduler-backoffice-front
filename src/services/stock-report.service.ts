// TASK-906 — the data seam of the Stock Report (Movement tab). Answers from a typed fixture until Sober cuts the BB reader (TASK-906 Q1);
// the wiring TASK swaps ONLY this body (`GET /v1/bo/stock/movements?from&to&type`, [team-proposed]). No component imports the fixture.
import { STOCK_MOVEMENTS_FIXTURE, STOCK_SALES_FIXTURE } from "@/services/__fixtures__/stock-report";
import { listStockProducts } from "@/services/stock.service";
import type { Role } from "@/types/app/roles";
import type { StockBalanceRow, StockMovementQuery, StockMovementRow, StockSalesQuery, StockSalesResult } from "@/types/app/stock-report";

export const STOCK_REPORT_SOURCE: "fixture" | "api" = "fixture";

/** The period's movements, newest first; both ends inclusive; CEO and Admin only (a Coach gets nothing — hide, never mask). */
export function listStockMovements(role: Role, q: StockMovementQuery): Promise<StockMovementRow[]> {
  if (role === "coach") return Promise.resolve([]);
  const rows = STOCK_MOVEMENTS_FIXTURE.filter((r) => r.occurredOn >= q.from && r.occurredOn <= q.to && (q.type === undefined || r.type === q.type)).sort(
    (a, b) => (a.occurredOn === b.occurredOn ? Number(b.id.slice(1)) - Number(a.id.slice(1)) : a.occurredOn < b.occurredOn ? 1 : -1),
  );
  return Promise.resolve(structuredClone(rows));
}

// ---- TASK-929: Sales History + Balance. Both stay on the fixture until BB deploys (the wiring TASK swaps these two bodies:
// `GET /v1/stock/sales?from&to&customer` (TASK-928, ceo+admin, no money) and, for Balance, the products read below, which has its own flag `STOCK_SOURCE.products`). ----

/** The period's sale lines, newest first; both ends inclusive; `customers` = the distinct buyers of the WINDOW (not of the filtered rows). CEO and Admin only (a Coach gets nothing). */
export async function listStockSales(role: Role, q: StockSalesQuery): Promise<StockSalesResult> {
  if (role === "coach") return { items: [], customers: [] };
  const inWindow = STOCK_SALES_FIXTURE.filter((r) => r.occurredOn >= q.from && r.occurredOn <= q.to);
  const customers = [...new Set(inWindow.map((r) => r.customer).filter((c): c is string => c !== null))].sort((a, b) => a.localeCompare(b));
  const items = inWindow
    .filter((r) => q.customer === undefined || r.customer === q.customer)
    .sort((a, b) => (a.occurredOn === b.occurredOn ? Number(b.id.slice(1)) - Number(a.id.slice(1)) : a.occurredOn < b.occurredOn ? 1 : -1));
  return structuredClone({ items, customers });
}

/** The Balance tab: every product (the active ones) with its CURRENT quantity — the products read, so it flips to the real route with the rest of the Stock block. */
export async function listStockBalances(role: Role): Promise<StockBalanceRow[]> {
  const products = await listStockProducts(role);
  return products.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity }));
}
