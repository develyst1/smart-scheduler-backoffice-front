// TASK-912 wiring — Stock IN on the real route (TASK-911): POST /v1/stock/in. No network: axios gets a recording adapter.
// Each test names the code whose removal makes it fail. Run: `bun test src/components/partials/Stock/stock-912-wire`.
import { afterEach, describe, expect, test } from "bun:test";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import { STOCK_SOURCE, StockWriteError, receiveStock } from "@/services/stock.service";
import type { StockInRequest } from "@/types/app/stock";

const realAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = realAdapter;
  STOCK_SOURCE.stockIn = "fixture";
});
function stub(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  STOCK_SOURCE.stockIn = "api";
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
const req: StockInRequest = { idempotencyKey: "receipt-key-0001", receivedOn: "2026-11-09", lines: [{ itemId: ITEM, qty: 5 }] };
const envelope = (code: string) => ({ error: { code, message: "x", details: {} } });
const fail = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

describe("receive — POST /v1/stock/in", () => {
  test("the request goes as built (idempotency key, receivedOn YYYY-MM-DD, lines of {itemId, qty}) — NO cost, NO price — and the answer is returned as is", async () => {
    const seen = stub(() => ({ status: 200, data: { receiptId: "r1", movementsWritten: 1, receivedOn: "2026-11-09" } }));
    const res = await receiveStock("admin", req);
    expect(seen.map((c) => `${c.method?.toUpperCase()} ${c.url}`)).toEqual(["POST /v1/stock/in"]);
    expect(JSON.parse(String(seen[0].data))).toEqual(req);
    expect(Object.keys(JSON.parse(String(seen[0].data)).lines[0]).sort()).toEqual(["itemId", "qty"]);
    expect(res.receiptId).toBe("r1");
  });
  test("the same key again (alreadyApplied: true) is the first result, not an error", async () => {
    stub(() => ({ status: 200, data: { receiptId: "r1", movementsWritten: 1, receivedOn: "2026-11-09", alreadyApplied: true } }));
    expect((await receiveStock("ceo", req)).alreadyApplied).toBe(true);
  });
  test("a Coach never reaches the route (FORBIDDEN, no request); an empty cart or a quantity that is not a whole number above 0 sends nothing (INVALID)", async () => {
    const seen = stub(() => ({ status: 200, data: {} }));
    const coach = await fail(receiveStock("coach", req));
    expect(coach instanceof StockWriteError && coach.code).toBe("FORBIDDEN");
    for (const lines of [[], [{ itemId: ITEM, qty: 0 }], [{ itemId: ITEM, qty: 1.5 }], [{ itemId: ITEM, qty: -2 }]]) {
      const e = await fail(receiveStock("ceo", { ...req, lines }));
      expect(e instanceof StockWriteError && e.code).toBe("INVALID");
    }
    expect(seen).toEqual([]);
  });
  test("404 UNKNOWN_ITEM → NOT_FOUND, 409 ITEM_INACTIVE → INVALID (English), 400 VALIDATION keeps the server's sentence; a body-less 502 is not swallowed", async () => {
    const cases: [number, string, string, string | null][] = [
      [404, "UNKNOWN_ITEM", "NOT_FOUND", "Product not found"],
      [409, "ITEM_INACTIVE", "INVALID", "This product is inactive"],
      [400, "VALIDATION", "INVALID", "x"],
    ];
    for (const [status, code, want, sentence] of cases) {
      stub(() => ({ status, data: envelope(code) }));
      const e = await fail(receiveStock("ceo", req));
      expect(e instanceof StockWriteError && [e.code, e.message]).toEqual([want, sentence]);
    }
    stub(() => ({ status: 502, data: "Bad gateway" }));
    const bad = await fail(receiveStock("ceo", req));
    expect(bad instanceof StockWriteError).toBe(false);
    expect(bad).not.toBeNull();
  });
});
