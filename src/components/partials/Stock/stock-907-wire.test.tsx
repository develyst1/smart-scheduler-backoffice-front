// TASK-907 wiring — the Product page's WRITES on the real routes (TASK-911): POST /v1/stock/products, PATCH /v1/stock/products/:id (CEO only), GET /v1/stock/revenue-categories.
// No network: axios gets a recording adapter. Each test names the code whose removal makes it fail. Run: `bun test src/components/partials/Stock/stock-907-wire`.
import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import { STOCK_SOURCE, StockWriteError, createStockProduct, listRevenueCategories, updateStockProduct } from "@/services/stock.service";
import { StockProductsBody } from "./StockProducts";
import { ProductFormBody } from "./ProductFormModal";
import { revenueCategoryOptions } from "./stock-product-logic";
import type { StockProduct } from "@/types/app/stock";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const realAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = realAdapter;
  STOCK_SOURCE.products = "fixture";
  STOCK_SOURCE.productWrites = "fixture";
});
function stub(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  STOCK_SOURCE.productWrites = "api";
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
const bodyOf = (c: InternalAxiosRequestConfig) => JSON.parse(String(c.data));
const envelope = (code: string, message: string) => ({ error: { code, message, details: {} } });
const DTO = { id: "11111111-1111-4111-8111-111111111111", code: "NEW-1", name: "New bike", category: "Bike", priceSatang: 129_050, quantity: 6, commissionGroup: null, active: true };
const CAT = "22222222-2222-4222-8222-222222222222";
const input = { code: " NEW-1 ", name: " New bike ", category: " Bike ", priceSatang: 129_050, commissionGroup: null, active: true, openingQuantity: 6, revenueCategoryId: CAT };

describe("create — POST /v1/stock/products", () => {
  test("the body is exactly the route's (trimmed code / name / category, satang, opening balance, revenueCategoryId); the answer is read back as a product", async () => {
    const seen = stub(() => ({ status: 201, data: DTO }));
    const made = await createStockProduct("ceo", input);
    expect(calls(seen)).toEqual(["POST /v1/stock/products"]);
    expect(bodyOf(seen[0])).toEqual({ code: "NEW-1", name: "New bike", category: "Bike", priceSatang: 129_050, commissionGroup: null, active: true, openingQuantity: 6, revenueCategoryId: CAT });
    expect([made.code, made.priceSatang, made.quantity]).toEqual(["NEW-1", 129_050, 6]);
  });
  test("an empty category goes as null, a missing opening balance as 0; a null price / balance / category in the answer reads as 0 / 0 / \"\"", async () => {
    const seen = stub(() => ({ status: 201, data: { ...DTO, category: null, priceSatang: null, quantity: null } }));
    const made = await createStockProduct("ceo", { ...input, category: "  ", openingQuantity: undefined });
    expect(bodyOf(seen[0])).toMatchObject({ category: null, openingQuantity: 0 });
    expect([made.category, made.priceSatang, made.quantity]).toEqual(["", 0, 0]);
  });
  test("an Admin and a Coach never reach the route (it is CEO-only): FORBIDDEN, and NO request", async () => {
    const seen = stub(() => ({ status: 201, data: DTO }));
    for (const role of ["admin", "coach"] as const) {
      const e = await createStockProduct(role, input).then(() => null, (x: unknown) => x);
      expect(e instanceof StockWriteError && e.code).toBe("FORBIDDEN");
    }
    expect(seen).toEqual([]);
  });
  test("the route's refusals read in English: 409 DUPLICATE_CODE → CODE_EXISTS, 400 UNKNOWN_REVENUE_CATEGORY / VALIDATION → INVALID (the server's sentence kept), a 403 → FORBIDDEN", async () => {
    const cases: [number, string, string, string, string][] = [
      [409, "DUPLICATE_CODE", "x", "CODE_EXISTS", "Model code already exists"],
      [400, "UNKNOWN_REVENUE_CATEGORY", "x", "INVALID", "Revenue category not found"],
      [400, "VALIDATION", "name too long", "INVALID", "name too long"],
      [403, "FORBIDDEN", "x", "FORBIDDEN", "Not allowed"],
    ];
    for (const [status, code, message, want, sentence] of cases) {
      stub(() => ({ status, data: envelope(code, message) }));
      const e = await createStockProduct("ceo", input).then(() => null, (x: unknown) => x);
      expect(e instanceof StockWriteError && [e.code, e.message]).toEqual([want, sentence]);
    }
  });
  test("a failure that is not an envelope (a 502 with no body) is not swallowed into a write refusal", async () => {
    stub(() => ({ status: 502, data: "Bad gateway" }));
    const e = await createStockProduct("ceo", input).then(() => null, (x: unknown) => x);
    expect(e instanceof StockWriteError).toBe(false);
    expect(e).not.toBeNull();
  });
});

describe("edit — PATCH /v1/stock/products/:id", () => {
  test("only the fields given are sent (never the code or the balance); the revenue category rides when it was changed", async () => {
    const seen = stub(() => ({ status: 200, data: { ...DTO, name: "Renamed" } }));
    await updateStockProduct("ceo", DTO.id, { name: " Renamed ", active: false, revenueCategoryId: CAT });
    expect(calls(seen)).toEqual([`PATCH /v1/stock/products/${DTO.id}`]);
    expect(bodyOf(seen[0])).toEqual({ name: "Renamed", active: false, revenueCategoryId: CAT });
  });
  test("a cleared commission group goes as null; an unknown id (404 UNKNOWN_ITEM) is NOT_FOUND; an Admin sends nothing", async () => {
    const seen = stub(() => ({ status: 200, data: DTO }));
    await updateStockProduct("ceo", DTO.id, { commissionGroup: null });
    expect(bodyOf(seen[0])).toEqual({ commissionGroup: null });
    stub(() => ({ status: 404, data: envelope("UNKNOWN_ITEM", "x") }));
    const missing = await updateStockProduct("ceo", "nope", { name: "x" }).then(() => null, (x: unknown) => x);
    expect(missing instanceof StockWriteError && missing.code).toBe("NOT_FOUND");
    const seen2 = stub(() => ({ status: 200, data: DTO }));
    const e = await updateStockProduct("admin", DTO.id, { name: "x" }).then(() => null, (x: unknown) => x);
    expect(e instanceof StockWriteError && e.code).toBe("FORBIDDEN");
    expect(seen2).toEqual([]);
  });
});

describe("the revenue categories — GET /v1/stock/revenue-categories", () => {
  const WIRE = { categories: [{ id: CAT, type: "SALES", name: "Equipment" }, { id: "c2", type: "FNB", name: "Drinks" }, { id: "c3", type: "SALES", name: "Apparel" }] };
  test("the CEO reads {categories}; an Admin / a Coach make no request", async () => {
    const seen = stub(() => ({ status: 200, data: WIRE }));
    expect((await listRevenueCategories("ceo")).map((c) => c.name)).toEqual(["Equipment", "Drinks", "Apparel"]);
    expect(calls(seen)).toEqual(["GET /v1/stock/revenue-categories"]);
    seen.length = 0;
    expect(await listRevenueCategories("admin")).toEqual([]);
    expect(await listRevenueCategories("coach")).toEqual([]);
    expect(seen).toEqual([]);
  });
  test("a body without `categories` is an empty list, not a crash", async () => {
    stub(() => ({ status: 200, data: { oops: true } }));
    expect(await listRevenueCategories("ceo")).toEqual([]);
  });
  test("the select groups them by type, keeping the route's order", () => {
    expect(revenueCategoryOptions(WIRE.categories)).toEqual([
      { group: "SALES", items: [{ value: CAT, label: "Equipment" }, { value: "c3", label: "Apparel" }] },
      { group: "FNB", items: [{ value: "c2", label: "Drinks" }] },
    ]);
  });
});

describe("the screen", () => {
  const P: StockProduct = { id: "p1", code: "A-1", name: "Alpha", category: "Bike", priceSatang: 100, quantity: 1, commissionGroup: null, active: true };
  test("the form has the REVENUE CATEGORY select (required on add: «Pick one»; on edit: «Keep current»)", () => {
    const add = ui(<ProductFormBody product={null} categories={[]} revenueCategories={[{ id: CAT, type: "SALES", name: "Equipment" }]} onClose={() => {}} onSave={async () => {}} />);
    expect(add).toContain('data-field="revenueCategoryId"');
    expect(add).toContain("REVENUE CATEGORY");
    expect(add).toContain("Pick one");
    expect(ui(<ProductFormBody product={P} categories={[]} onClose={() => {}} onSave={async () => {}} />)).toContain("Keep current");
  });
  test("an Admin sees the list but no «Add product» and no «Edit» (the real routes are the CEO's); the CEO sees both", () => {
    const admin = ui(<StockProductsBody products={[P]} canWrite={false} onCreate={async () => {}} onUpdate={async () => {}} />);
    expect(admin).toContain("Alpha");
    expect(admin).not.toContain("Add product");
    expect(admin).not.toContain(">Edit<");
    const ceo = ui(<StockProductsBody products={[P]} onCreate={async () => {}} onUpdate={async () => {}} />);
    expect(ceo).toContain("Add product");
    expect(ceo).toContain("Edit");
  });
});
