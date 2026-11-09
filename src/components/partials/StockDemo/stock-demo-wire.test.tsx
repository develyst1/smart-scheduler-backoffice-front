// The Stock Demo WIRED to the live backoffice (BB 693627d, TASK-915): the request each call sends and what it does with the answer. No network: axios gets a recording adapter.
// Run: `bun test src/components/partials/StockDemo`. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api, ApiClientError } from "@/lib/api/client";
import { DEMO_HISTORY_LIMIT, STOCK_DEMO_SOURCE, addDemoSite, defectInDemo, deleteDemo, getDemoStock, historyWindow, listDemoMovements, moveDemo, orderDemoSites } from "@/services/stock-demo.service";
import { demoNegativeDetails } from "./demo-logic";

const realAdapter = api.defaults.adapter;
let left: "fixture" | "api" | null = null;
afterEach(() => {
  api.defaults.adapter = realAdapter;
  if (left) STOCK_DEMO_SOURCE.demo = left;
  left = null;
});

/** The live branch on for the test, whatever another file left behind; every request is recorded. */
function live(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  left = STOCK_DEMO_SOURCE.demo;
  STOCK_DEMO_SOURCE.demo = "api";
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
const body = (c: InternalAxiosRequestConfig) => JSON.parse(String(c.data));
const OK = { occurredOn: "2026-11-09", balances: { s1: 3 }, movementsWritten: 1 };
const KEY = "fe-test-key-0001";

describe("shipped switch", () => {
  test("the demo ships wired (api) — read from the source, not from the live object", () => {
    expect(readFileSync("src/services/stock-demo.service.ts", "utf8")).toContain('{ demo: "api" }');
  });
});

describe("reads", () => {
  test("GET /v1/demo/stock returns the sites and items; a missing list is empty", async () => {
    const seen = live(() => ({ status: 200, data: { sites: [{ id: "s1", name: "Bravo", sortOrder: 1 }], items: [{ id: "i1", category: "c", name: "Helmet", remark: null, saleItemId: null, balances: { s1: 3 }, total: 3 }] } }));
    const s = await getDemoStock("ceo");
    expect(seen[0].url).toBe("/v1/demo/stock");
    expect(s.sites[0].name).toBe("Bravo");
    expect(s.items[0].total).toBe(3);
    live(() => ({ status: 200, data: {} }));
    expect(await getDemoStock("admin")).toEqual({ sites: [], items: [] });
  });

  test("GET /v1/demo/movements asks for the last 366 days ending today (Bangkok) and the row limit", async () => {
    const seen = live(() => ({ status: 200, data: { items: [{ id: "m1", occurredOn: "2026-11-09", who: "Ploy", itemId: "i1", itemName: "Helmet", type: "MOVE", qty: 1, from: "Bravo", to: "STA", reason: "x" }] } }));
    const rows = await listDemoMovements("ceo");
    expect(seen[0].url).toBe("/v1/demo/movements");
    const { from, to, limit } = seen[0].params;
    expect(limit).toBe(DEMO_HISTORY_LIMIT);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)).toBe(365); // the route's maximum span, both ends inclusive
    expect(rows[0].who).toBe("Ploy");
  });

  test("historyWindow: exactly 365 days back from the given day, across a year end and a leap day", () => {
    expect(historyWindow("2026-11-09")).toEqual({ from: "2025-11-09", to: "2026-11-09" });
    expect(historyWindow("2026-01-01")).toEqual({ from: "2025-01-01", to: "2026-01-01" });
    expect(historyWindow("2024-12-31")).toEqual({ from: "2024-01-01", to: "2024-12-31" }); // 2024 is a leap year: 365 days back lands on 1 Jan
  });
});

describe("writes", () => {
  test("Move → POST /v1/demo/move with exactly the five fields and a trimmed reason", async () => {
    const seen = live(() => ({ status: 200, data: OK }));
    const out = await moveDemo({ key: KEY, itemId: "i1", fromSiteId: "s1", toSiteId: "s2", qty: 2, reason: "  class  ", extra: "no" } as never, "ceo");
    expect(seen[0].url).toBe("/v1/demo/move");
    expect(seen[0].method).toBe("post");
    expect(body(seen[0])).toEqual({ key: KEY, itemId: "i1", fromSiteId: "s1", toSiteId: "s2", qty: 2, reason: "class" });
    expect(out.movementsWritten).toBe(1);
  });

  test("Defect → POST /v1/demo/defect-in; nothing about sale stock goes with it", async () => {
    const seen = live(() => ({ status: 200, data: OK }));
    await defectInDemo({ key: KEY, itemId: "i1", toSiteId: "s2", qty: 1, reason: "cracked" }, "admin");
    expect(seen[0].url).toBe("/v1/demo/defect-in");
    expect(body(seen[0])).toEqual({ key: KEY, itemId: "i1", toSiteId: "s2", qty: 1, reason: "cracked" });
  });

  test("Delete → partial sends siteId + qty together; whole sends neither", async () => {
    const seen = live(() => ({ status: 200, data: OK }));
    await deleteDemo({ key: KEY, itemId: "i1", siteId: "s1", qty: 2, reason: "broken" }, "ceo");
    await deleteDemo({ key: "fe-test-key-0002", itemId: "i1", reason: "retired" }, "ceo");
    expect(seen[0].url).toBe("/v1/demo/delete");
    expect(body(seen[0])).toEqual({ key: KEY, itemId: "i1", reason: "broken", siteId: "s1", qty: 2 });
    expect(body(seen[1])).toEqual({ key: "fe-test-key-0002", itemId: "i1", reason: "retired" });
  });

  test("Add Location → POST /v1/demo/sites {name}; Location Order → PUT /v1/demo/sites/order {ids}", async () => {
    const seen = live((c) => (c.method === "put" ? { status: 200, data: { ids: ["s2", "s1"] } } : { status: 201, data: { id: "s9", name: "ISB", sortOrder: 6 } }));
    const site = await addDemoSite("  ISB ", "ceo");
    expect(seen[0].url).toBe("/v1/demo/sites");
    expect(body(seen[0])).toEqual({ name: "ISB" });
    expect(site.name).toBe("ISB");
    expect(await orderDemoSites(["s2", "s1"], "ceo")).toEqual(["s2", "s1"]);
    expect(seen[1].url).toBe("/v1/demo/sites/order");
    expect(seen[1].method).toBe("put");
    expect(body(seen[1])).toEqual({ ids: ["s2", "s1"] });
  });

  test("a repeat of the same key answers alreadyApplied and the seam passes it through", async () => {
    live(() => ({ status: 200, data: { ...OK, movementsWritten: 0, alreadyApplied: true } }));
    const out = await moveDemo({ key: KEY, itemId: "i1", fromSiteId: "s1", toSiteId: "s2", qty: 1, reason: "x" }, "ceo");
    expect(out.alreadyApplied).toBe(true);
  });
});

describe("refusals (the app's envelope)", () => {
  test("409 NEGATIVE_BALANCE carries error.details {itemId, siteId, name, resultingBalance}", async () => {
    live(() => ({ status: 409, data: { error: { code: "NEGATIVE_BALANCE", message: "Helmet: ติดลบ", details: { itemId: "i1", siteId: "s1", name: "Helmet", resultingBalance: -2 } } } }));
    const err = await moveDemo({ key: KEY, itemId: "i1", fromSiteId: "s1", toSiteId: "s2", qty: 9, reason: "x" }, "ceo").catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.status).toBe(409);
    expect(demoNegativeDetails(err)).toEqual({ itemId: "i1", siteId: "s1", name: "Helmet", resultingBalance: -2 });
  });

  test("409 DUPLICATE_SITE and a 400 surface the server's own sentence", async () => {
    live(() => ({ status: 409, data: { error: { code: "DUPLICATE_SITE", message: "มีสถานที่ «ISB» อยู่แล้ว", details: { name: "ISB" } } } }));
    expect((await addDemoSite("ISB", "ceo").catch((e) => e)).message).toBe("มีสถานที่ «ISB» อยู่แล้ว");
    live(() => ({ status: 400, data: { error: { code: "VALIDATION", message: "ต้องบอกเหตุผล ระบบเก็บประวัติไว้", details: { field: "reason" } } } }));
    const e = await moveDemo({ key: KEY, itemId: "i1", fromSiteId: "s1", toSiteId: "s2", qty: 1, reason: "x" }, "ceo").catch((x) => x);
    expect(e.code).toBe("VALIDATION");
  });
});

describe("who may call it", () => {
  test("a Coach and a signed-out caller are refused 403 before any request; CEO and Admin go through", async () => {
    const seen = live(() => ({ status: 200, data: { sites: [], items: [] } }));
    for (const role of ["coach", null] as const) {
      expect((await getDemoStock(role).catch((e) => e.status)) as number).toBe(403);
      expect((await moveDemo({ key: KEY, itemId: "i", fromSiteId: "a", toSiteId: "b", qty: 1, reason: "x" }, role).catch((e) => e.status)) as number).toBe(403);
    }
    expect(seen).toHaveLength(0);
    await getDemoStock("admin");
    await getDemoStock("ceo");
    expect(seen).toHaveLength(2);
  });
});
