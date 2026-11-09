// TASK-913 wiring — Low Stock on the real routes (TASK-919): GET /v1/stock/low-stock, GET + PUT /v1/stock/low-stock/thresholds. No network: axios gets a recording adapter.
// Each test names the code whose removal makes it fail. Run: `bun test src/components/partials/Stock/stock-913-wire`.
import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import { STOCK_SOURCE, StockWriteError, getLowStockThresholds, listLowStock, setLowStockThresholds } from "@/services/stock.service";
import { LowStockBody } from "./LowStock";
import type { LowStockRow, StockProduct } from "@/types/app/stock";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const realAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = realAdapter;
  STOCK_SOURCE.lowStock = "fixture";
});
function stub(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  STOCK_SOURCE.lowStock = "api";
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
const calls = (seen: InternalAxiosRequestConfig[]) => seen.map((c) => `${(c.method ?? "get").toUpperCase()} ${c.url}`);
const fail = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);
const TH = { "F&B": 10, Safety: 1, Bike: null };
const ROWS: LowStockRow[] = [
  { id: "a", code: "FB-WAT-070", name: "Water 600 ml", category: "F&B", quantity: 8, threshold: 10, under: 2 },
  { id: "b", code: "MIL-HEL-010", name: "Miller helmet — M", category: "Miller", quantity: 4, threshold: 5, under: 1 },
];

describe("the reads", () => {
  test("the list is GET /v1/stock/low-stock → {items}; the thresholds are GET /v1/stock/low-stock/thresholds → {thresholds}; a Coach makes no request", async () => {
    const seen = stub((c) => ({ status: 200, data: c.url?.endsWith("/thresholds") ? { thresholds: TH } : { items: ROWS } }));
    expect((await listLowStock("admin")).map((r) => r.code)).toEqual(["FB-WAT-070", "MIL-HEL-010"]);
    expect(await getLowStockThresholds("ceo")).toEqual(TH);
    expect(calls(seen)).toEqual(["GET /v1/stock/low-stock", "GET /v1/stock/low-stock/thresholds"]);
    seen.length = 0;
    expect(await listLowStock("coach")).toEqual([]);
    expect(await getLowStockThresholds("coach")).toEqual({});
    expect(seen).toEqual([]);
  });
  test("a body that is not the expected shape is an empty list / an empty map, not a crash", async () => {
    stub(() => ({ status: 200, data: { oops: true } }));
    expect(await listLowStock("ceo")).toEqual([]);
    expect(await getLowStockThresholds("ceo")).toEqual({});
  });
});

describe("the save — PUT /v1/stock/low-stock/thresholds", () => {
  test("the whole map goes as {thresholds} (a null for «no alert»); the saved map the server answers is returned", async () => {
    const seen = stub((c) => ({ status: 200, data: { thresholds: JSON.parse(String(c.data)).thresholds } }));
    const saved = await setLowStockThresholds("ceo", TH);
    expect(calls(seen)).toEqual(["PUT /v1/stock/low-stock/thresholds"]);
    expect(JSON.parse(String(seen[0].data))).toEqual({ thresholds: TH });
    expect(saved).toEqual(TH);
  });
  test("a wrong level (a fraction, a negative) and a Coach send NOTHING (INVALID / FORBIDDEN); the route's 400 VALIDATION keeps the server's sentence", async () => {
    const seen = stub(() => ({ status: 200, data: { thresholds: {} } }));
    for (const bad of [{ A: 1.5 }, { A: -1 }, { " ": 3 }] as Record<string, number>[]) {
      const e = await fail(setLowStockThresholds("ceo", bad));
      expect(e instanceof StockWriteError && e.code).toBe("INVALID");
    }
    const coach = await fail(setLowStockThresholds("coach", TH));
    expect(coach instanceof StockWriteError && coach.code).toBe("FORBIDDEN");
    expect(seen).toEqual([]);
    stub(() => ({ status: 400, data: { error: { code: "VALIDATION", message: "1 threshold(s) are invalid", details: {} } } }));
    const refused = await fail(setLowStockThresholds("ceo", TH));
    expect(refused instanceof StockWriteError && [refused.code, refused.message]).toEqual(["INVALID", "1 threshold(s) are invalid"]);
  });
});

describe("the screen", () => {
  const P = (code: string, category: string, quantity: number): StockProduct => ({ id: code, code, name: code, category, priceSatang: 1, quantity, active: true });
  test("the list is the SERVER's rows when given (code · name · category · balance · level · under by), not recomputed from the products", () => {
    const html = ui(<LowStockBody products={[P("Z-1", "Bike", 0)]} thresholds={{ Bike: 5 }} low={ROWS} onSave={async () => {}} />);
    for (const w of ["FB-WAT-070", "Water 600 ml", "MIL-HEL-010", "2 low"]) expect(html).toContain(w);
    expect(html).not.toContain("Z-1 "); // the Bike product is under its level here, but the server did not list it — the screen draws what the server says
    expect(html).not.toMatch(/฿/);
  });
  test("with no server rows given (the fixture twin) the same rule runs here, on the EXACT category: «Miller division» is not «Miller»", () => {
    const html = ui(<LowStockBody products={[P("M-1", "Miller division", 0), P("M-2", "Miller", 0)]} thresholds={{ Miller: 5 }} onSave={async () => {}} />);
    expect(html).toContain('data-low-row="M-2"');
    expect(html).not.toContain('data-low-row="M-1"');
    expect(html).toContain('data-type-row="Miller division"'); // the category that matched no type is offered in the Setting list, to be given a level
  });
});
