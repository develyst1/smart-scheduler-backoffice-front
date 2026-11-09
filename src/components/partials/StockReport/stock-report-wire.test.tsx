// The Stock Report WIRED to the live backoffice (BB 693627d): the request each tab sends and what it does with the answer. No network: axios gets a recording adapter.
// Run: `bun test src/components/partials/StockReport`. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api, ApiClientError } from "@/lib/api/client";
import { REPORT_ROW_LIMIT, STOCK_REPORT_SOURCE, listStockBalances, listStockMovements, listStockSales } from "@/services/stock-report.service";
import { STOCK_SOURCE } from "@/services/stock.service";

const realAdapter = api.defaults.adapter;
// the flags as another test file left them (some set the products flag to the fixture at import time); each test puts back exactly that
let left: { movements: "fixture" | "api"; sales: "fixture" | "api"; products: "fixture" | "api" } | null = null;
afterEach(() => {
  api.defaults.adapter = realAdapter;
  if (left) {
    Object.assign(STOCK_REPORT_SOURCE, { movements: left.movements, sales: left.sales });
    STOCK_SOURCE.products = left.products;
    left = null;
  }
});

/** The live branch on: every flag "api" for the test, whatever another file left behind. */
function live(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  left = { movements: STOCK_REPORT_SOURCE.movements, sales: STOCK_REPORT_SOURCE.sales, products: STOCK_SOURCE.products };
  Object.assign(STOCK_REPORT_SOURCE, { movements: "api", sales: "api" });
  STOCK_SOURCE.products = "api";
  const seen: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    seen.push(config);
    const { status, data } = answer(config);
    const response = { status, data, statusText: "", headers: {}, config };
    if (status >= 400) throw new AxiosError(`HTTP ${status}`, "ERR_BAD_REQUEST", config, null, response);
    return response;
  };
  return seen;
}

const MOVE = { id: "m1", occurredOn: "2026-11-09", itemId: "i1", itemName: "Helmet", type: "SALE", qty: -1, remainingAfter: 4 };
const SALE = { id: "l1", saleId: "s1", occurredOn: "2026-11-09", itemId: "i1", code: "H-1", name: "Helmet", qty: 1, customer: null, payment: "CASH", branch: "BRAVO" };

describe("shipped switches", () => {
  test("the report ships wired: movements and sales are api, and Balance follows the products flag (api) — read from the source, not from the live object", () => {
    expect(readFileSync("src/services/stock-report.service.ts", "utf8")).toContain('{ movements: "api", sales: "api" }');
    expect(readFileSync("src/services/stock.service.ts", "utf8")).toMatch(/products: "api"/);
  });
});

describe("Movement → GET /v1/bo/stock/movements", () => {
  test("sends from, to, the type when chosen, and the row limit; returns the server's items as they are", async () => {
    const seen = live(() => ({ status: 200, data: { items: [MOVE] } }));
    const rows = await listStockMovements("ceo", { from: "2026-11-01", to: "2026-11-30", type: "SALE" });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("/v1/bo/stock/movements");
    expect(seen[0].params).toEqual({ from: "2026-11-01", to: "2026-11-30", type: "SALE", limit: REPORT_ROW_LIMIT });
    expect(rows).toEqual([MOVE]);
  });

  test("no type chosen → no type param; a body without items is an empty list, not a crash", async () => {
    const seen = live(() => ({ status: 200, data: {} }));
    expect(await listStockMovements("admin", { from: "2026-11-01", to: "2026-11-30" })).toEqual([]);
    expect(Object.keys(seen[0].params).sort()).toEqual(["from", "limit", "to"]);
  });

  test("a Coach never sends a request", async () => {
    const seen = live(() => ({ status: 200, data: { items: [MOVE] } }));
    expect(await listStockMovements("coach", { from: "2026-11-01", to: "2026-11-30" })).toEqual([]);
    expect(seen).toHaveLength(0);
  });

  test("the server's refusal surfaces as the envelope error (e.g. a window over 366 days → 400)", async () => {
    live(() => ({ status: 400, data: { error: { code: "VALIDATION", message: "ช่วงวันที่ต้องไม่เกิน 366 วัน", details: {} } } }));
    const err = await listStockMovements("ceo", { from: "2025-01-01", to: "2026-11-30" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.message).toBe("ช่วงวันที่ต้องไม่เกิน 366 วัน");
  });
});

describe("Sales History → GET /v1/stock/sales", () => {
  test("sends from, to, the customer when one is picked, and the row limit; keeps items and customers", async () => {
    const seen = live(() => ({ status: 200, data: { items: [SALE], customers: ["Khun Ton"] } }));
    const r = await listStockSales("ceo", { from: "2026-11-01", to: "2026-11-30", customer: "Khun Ton" });
    expect(seen[0].url).toBe("/v1/stock/sales");
    expect(seen[0].params).toEqual({ from: "2026-11-01", to: "2026-11-30", customer: "Khun Ton", limit: REPORT_ROW_LIMIT });
    expect(r).toEqual({ items: [SALE], customers: ["Khun Ton"] });
  });

  test("everyone → no customer param; a missing list is empty", async () => {
    const seen = live(() => ({ status: 200, data: { items: [SALE] } }));
    const r = await listStockSales("admin", { from: "2026-11-01", to: "2026-11-30" });
    expect(Object.keys(seen[0].params).sort()).toEqual(["from", "limit", "to"]);
    expect(r.customers).toEqual([]);
  });

  test("a no-buyer / no-method row passes through as null (the screen words them)", async () => {
    live(() => ({ status: 200, data: { items: [{ ...SALE, payment: null }], customers: [] } }));
    const r = await listStockSales("ceo", { from: "2026-11-09", to: "2026-11-09" });
    expect(r.items[0].customer).toBeNull();
    expect(r.items[0].payment).toBeNull();
  });

  test("a Coach never sends a request", async () => {
    const seen = live(() => ({ status: 200, data: { items: [SALE], customers: [] } }));
    expect(await listStockSales("coach", { from: "2026-11-01", to: "2026-11-30" })).toEqual({ items: [], customers: [] });
    expect(seen).toHaveLength(0);
  });
});

describe("Balance → GET /v1/stock/products", () => {
  test("reads the products route and keeps name + current quantity of the ACTIVE products, by name", async () => {
    const seen = live(() => ({
      status: 200,
      data: [
        { id: "b", code: "B", name: "Bike", category: null, priceSatang: 100, quantity: 3, commissionGroup: null, active: true },
        { id: "a", code: "A", name: "Apple", category: "F&B", priceSatang: 100, quantity: 0, commissionGroup: null, active: true },
        { id: "z", code: "Z", name: "Zed (retired)", category: null, priceSatang: 100, quantity: 9, commissionGroup: null, active: false },
      ],
    }));
    const rows = await listStockBalances("ceo");
    expect(seen[0].url).toBe("/v1/stock/products");
    expect(rows).toEqual([
      { id: "a", name: "Apple", quantity: 0 },
      { id: "b", name: "Bike", quantity: 3 },
    ]);
  });
});
