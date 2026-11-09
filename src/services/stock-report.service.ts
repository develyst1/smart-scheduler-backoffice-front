// The data seam of the Stock Report: TASK-906 (Movement), TASK-929 (Sales History, Balance). WIRED to the live backoffice (BB 693627d): each flag below is "api", and the fixture
// branch stays behind it (the tests flip a flag to read it; the sample-data notice shows while ANY tab is still on the fixture). No component imports the fixture.
//   Movement → GET /v1/bo/stock/movements?from&to&type&limit   (ceo + admin, `{ items }`, no money)
//   Sales    → GET /v1/stock/sales?from&to&customer&limit      (ceo + admin, `{ items, customers }`, no money; TASK-928)
//   Balance  → the products read (`listStockProducts`, `GET /v1/stock/products`), so it follows `STOCK_SOURCE.products`
import { api } from "@/lib/api/client";
import { STOCK_MOVEMENTS_FIXTURE, STOCK_SALES_FIXTURE } from "@/services/__fixtures__/stock-report";
import { STOCK_SOURCE, listStockProducts } from "@/services/stock.service";
import type { Role } from "@/types/app/roles";
import type { StockBalanceRow, StockMovementQuery, StockMovementRow, StockSalesQuery, StockSalesResult } from "@/types/app/stock-report";

export const STOCK_REPORT_SOURCE: Record<"movements" | "sales", "fixture" | "api"> = { movements: "api", sales: "api" };

/** True while any tab of the report still shows made-up rows (the page then says "Sample data"). Balance follows the products flag. */
export const stockReportIsSample = (): boolean => STOCK_REPORT_SOURCE.movements === "fixture" || STOCK_REPORT_SOURCE.sales === "fixture" || STOCK_SOURCE.products === "fixture";

/** The most rows the reads return in one answer (their own maximum); a period needing more is cut there, newest first. */
export const REPORT_ROW_LIMIT = 1000;

/** The period's movements, newest first; both ends inclusive; CEO and Admin only (a Coach gets nothing — hide, never mask). */
export async function listStockMovements(role: Role, q: StockMovementQuery): Promise<StockMovementRow[]> {
  if (role === "coach") return [];
  if (STOCK_REPORT_SOURCE.movements === "api") {
    const { data } = await api.get<{ items?: StockMovementRow[] }>("/v1/bo/stock/movements", {
      params: { from: q.from, to: q.to, ...(q.type ? { type: q.type } : {}), limit: REPORT_ROW_LIMIT },
    });
    return Array.isArray(data?.items) ? data.items : [];
  }
  const rows = STOCK_MOVEMENTS_FIXTURE.filter((r) => r.occurredOn >= q.from && r.occurredOn <= q.to && (q.type === undefined || r.type === q.type)).sort(
    (a, b) => (a.occurredOn === b.occurredOn ? Number(b.id.slice(1)) - Number(a.id.slice(1)) : a.occurredOn < b.occurredOn ? 1 : -1),
  );
  return structuredClone(rows);
}

/** The period's sale lines, newest first; both ends inclusive; `customers` = the distinct buyers of the WINDOW (not of the filtered rows). CEO and Admin only (a Coach gets nothing). */
export async function listStockSales(role: Role, q: StockSalesQuery): Promise<StockSalesResult> {
  if (role === "coach") return { items: [], customers: [] };
  if (STOCK_REPORT_SOURCE.sales === "api") {
    const { data } = await api.get<Partial<StockSalesResult>>("/v1/stock/sales", {
      params: { from: q.from, to: q.to, ...(q.customer !== undefined ? { customer: q.customer } : {}), limit: REPORT_ROW_LIMIT },
    });
    return { items: Array.isArray(data?.items) ? data.items : [], customers: Array.isArray(data?.customers) ? data.customers : [] };
  }
  const inWindow = STOCK_SALES_FIXTURE.filter((r) => r.occurredOn >= q.from && r.occurredOn <= q.to);
  const customers = [...new Set(inWindow.map((r) => r.customer).filter((c): c is string => c !== null))].sort((a, b) => a.localeCompare(b));
  const items = inWindow
    .filter((r) => q.customer === undefined || r.customer === q.customer)
    .sort((a, b) => (a.occurredOn === b.occurredOn ? Number(b.id.slice(1)) - Number(a.id.slice(1)) : a.occurredOn < b.occurredOn ? 1 : -1));
  return structuredClone({ items, customers });
}

/** The Balance tab: every product (the active ones) with its CURRENT quantity — the products read, so it is live as soon as `STOCK_SOURCE.products` is. */
export async function listStockBalances(role: Role): Promise<StockBalanceRow[]> {
  const products = await listStockProducts(role);
  return products.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity }));
}
