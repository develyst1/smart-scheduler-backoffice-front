// TASK-910 wiring — Stock OUT on the real route (TASK-909): POST /v1/stock/out. No network: axios gets a recording adapter.
// Each test names the code whose removal makes it fail. Run: `bun test src/components/partials/Stock/stock-910-wire`.
import { afterEach, describe, expect, test } from "bun:test";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import { NegativeBalanceError, STOCK_SOURCE, StockWriteError, sellStockOut } from "@/services/stock.service";
import type { StockOutRequest } from "@/types/app/stock";

const realAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = realAdapter;
  STOCK_SOURCE.out = "fixture";
});
function stub(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  STOCK_SOURCE.out = "api";
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
const ITEM = "11111111-1111-4111-8111-111111111111";
const req: StockOutRequest = {
  idempotencyKey: "cart-key-0001",
  method: "TRANSFER",
  soldAt: "2026-11-09",
  sellerRefs: ["t-1"],
  lines: [{ itemId: ITEM, qty: 2, unitPriceSatang: 129_000, discountSatang: 1_000, commissionSatang: 5_000 }],
};
const envelope = (code: string, details: Record<string, unknown> = {}) => ({ error: { code, message: "x", details } });
const fail = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

describe("sell — POST /v1/stock/out", () => {
  test("the request goes as built (idempotency key, METHOD, soldAt, sellerRefs, each line with its discount and commission); the answer is returned as is", async () => {
    const seen = stub(() => ({ status: 200, data: { saleId: "s1", movementsWritten: 1, soldAt: "2026-11-09T00:00:00.000Z" } }));
    const res = await sellStockOut("admin", req);
    expect(seen.map((c) => `${c.method?.toUpperCase()} ${c.url}`)).toEqual(["POST /v1/stock/out"]);
    expect(JSON.parse(String(seen[0].data))).toEqual(req);
    expect(res.saleId).toBe("s1");
    expect(res.alreadyApplied).toBeUndefined();
  });
  test("the same key again (alreadyApplied: true) is the first result, not an error", async () => {
    stub(() => ({ status: 200, data: { saleId: "s1", movementsWritten: 1, soldAt: "2026-11-09T00:00:00.000Z", alreadyApplied: true } }));
    expect((await sellStockOut("ceo", req)).alreadyApplied).toBe(true);
  });
  test("a Coach never reaches the route: FORBIDDEN, no request", async () => {
    const seen = stub(() => ({ status: 200, data: {} }));
    const e = await fail(sellStockOut("coach", req));
    expect(e instanceof StockWriteError && e.code).toBe("FORBIDDEN");
    expect(seen).toEqual([]);
  });
});

describe("the refusals", () => {
  test("409 NEGATIVE_BALANCE → a NegativeBalanceError carrying error.details {model, name, resultingBalance} — the screen's red alert names the item", async () => {
    stub(() => ({ status: 409, data: envelope("NEGATIVE_BALANCE", { model: "MIL-HEL-010", name: "Miller helmet — M", resultingBalance: -2 }) }));
    const e = await fail(sellStockOut("ceo", req));
    expect(e instanceof NegativeBalanceError).toBe(true);
    const n = e as NegativeBalanceError;
    expect([n.model, n.productName, n.resultingBalance]).toEqual(["MIL-HEL-010", "Miller helmet — M", -2]);
    expect(n.body.error.details).toEqual({ model: "MIL-HEL-010", name: "Miller helmet — M", resultingBalance: -2 });
  });
  test("400 METHOD_REQUIRED, 400 NO_REVENUE_CATEGORY, 409 ITEM_INACTIVE, 404 UNKNOWN_ITEM read as StockWriteError with the screens' English", async () => {
    const cases: [number, string, string, string][] = [
      [400, "METHOD_REQUIRED", "METHOD_REQUIRED", "Payment method is required"],
      [400, "NO_REVENUE_CATEGORY", "INVALID", "This product has no revenue category — set it on the Product page first"],
      [409, "ITEM_INACTIVE", "INVALID", "This product is inactive"],
      [404, "UNKNOWN_ITEM", "NOT_FOUND", "Product not found"],
    ];
    for (const [status, code, want, sentence] of cases) {
      stub(() => ({ status, data: envelope(code) }));
      const e = await fail(sellStockOut("ceo", req));
      expect(e instanceof StockWriteError && [e.code, e.message]).toEqual([want, sentence]);
    }
  });
  test("a refusal code the screen does not know passes through untouched (its own message), and a body-less 502 is not turned into a write refusal", async () => {
    stub(() => ({ status: 409, data: envelope("STALE") }));
    const odd = await fail(sellStockOut("ceo", req));
    expect(odd instanceof StockWriteError).toBe(false);
    expect(odd instanceof NegativeBalanceError).toBe(false);
    expect((odd as { code?: string }).code).toBe("STALE");
    stub(() => ({ status: 502, data: "Bad gateway" }));
    const bad = await fail(sellStockOut("ceo", req));
    expect(bad instanceof StockWriteError).toBe(false);
    expect(bad).not.toBeNull();
  });
});
