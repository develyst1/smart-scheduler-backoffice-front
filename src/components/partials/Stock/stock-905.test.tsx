// TASK-905 — Stock Out product picker + search (the typed fixture seam; the real read waits on Sober's Q1). Run: `bun test src/components/partials/Stock`.
// Each test names the code whose removal makes it fail.
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { afterEach } from "bun:test";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import { canOpen, menuFor } from "@/lib/roles/pages";
import { STOCK_SOURCE, listStockProducts } from "@/services/stock.service";
import { addToCart, bahtText, filterProducts, isPickable, matchesQuery, productLabel, removeFromCart } from "./stock-picker-logic";
import StockProductPicker from "./StockProductPicker";
import { StockOutPickerBody } from "./StockOutPicker";
import type { StockProduct } from "@/types/app/stock";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const noop = () => {};
STOCK_SOURCE.products = "fixture"; // the shipped switch is "api" (asserted below from the service's source); these tests read the fixture, the API branch is stubbed further down
const all = await listStockProducts("ceo");
const by = (code: string) => all.find((p) => p.code === code) as StockProduct;
const codes = (xs: StockProduct[]) => xs.map((p) => p.code);

describe("the seam (listStockProducts)", () => {
  test("CEO and Admin get the active products by name; a Coach gets nothing (hidden, never masked); the inactive one is never offered", async () => {
    expect(all.length).toBe(11);
    expect(all.some((p) => p.code === "OLD-HEL-099")).toBe(false);
    expect(all.map((p) => p.name)).toEqual([...all.map((p) => p.name)].sort((a, b) => a.localeCompare(b)));
    expect((await listStockProducts("admin")).length).toBe(11);
    expect(await listStockProducts("coach")).toEqual([]);
  });
  test("integer satang, and the balance rides along (the sold-out Sock stays listed with 0)", () => {
    expect(by("MIL-IN-001").priceSatang).toBe(390_000);
    expect(Number.isInteger(by("FB-WAT-070").priceSatang)).toBe(true);
    expect(by("OTH-SOC-081").quantity).toBe(0);
  });
  test("the SHIPPED switch is \"api\" (read from the service's source: a test pins the fixture at run time), the shape has NO location, and no component imports the fixture (only the service does)", () => {
    expect(/products: "api"/.test(readFileSync("src/services/stock.service.ts", "utf8"))).toBe(true);
    expect(all.every((p) => !("location" in p))).toBe(true);
    for (const f of readdirSync("src/components/partials/Stock").filter((x) => /\.(tsx?|ts)$/.test(x) && !/\.test\.tsx?$/.test(x))) {
      expect(readFileSync(`src/components/partials/Stock/${f}`, "utf8")).not.toContain("__fixtures__");
    }
  });
});

describe("the search box (matchesQuery / filterProducts)", () => {
  test("an empty box lists everything", () => {
    expect(filterProducts(all, "").length).toBe(11);
    expect(filterProducts(all, "   ").length).toBe(11);
  });
  test("matches the Model code OR the name, any case", () => {
    expect(codes(filterProducts(all, "mil-hel"))).toEqual(["MIL-HEL-010"]);
    expect(codes(filterProducts(all, "SNACK"))).toEqual(["FB-SNK-071"]);
    expect(codes(filterProducts(all, "helmet")).sort()).toEqual(["ANI-HEL-020", "MIL-HEL-010"]);
  });
  test("every typed word must appear, in any order: «mil hel» finds the Miller helmet, «hel mil» too, «mil water» nothing", () => {
    expect(codes(filterProducts(all, "mil hel"))).toEqual(["MIL-HEL-010"]);
    expect(codes(filterProducts(all, "hel mil"))).toEqual(["MIL-HEL-010"]);
    expect(filterProducts(all, "mil water")).toEqual([]);
  });
  test("the label is «CODE · name»", () => {
    expect(productLabel(by("MIL-HEL-010"))).toBe("MIL-HEL-010 · Miller helmet — M");
    expect(matchesQuery({ code: "A-1", name: "Zed" }, "a-1 zed")).toBe(true);
  });
});

describe("the cart stub (addToCart / removeFromCart)", () => {
  test("a pick adds a row of quantity 1; the same product again raises its quantity, never above the balance", () => {
    const helmet = by("MIL-HEL-010"); // balance 4
    let cart = addToCart([], helmet);
    expect(cart.map((r) => [r.product.code, r.quantity])).toEqual([["MIL-HEL-010", 1]]);
    for (let i = 0; i < 10; i++) cart = addToCart(cart, helmet);
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(4);
  });
  test("a sold-out product cannot be added; Remove drops the row", () => {
    const sock = by("OTH-SOC-081");
    expect(isPickable(sock)).toBe(false);
    expect(addToCart([], sock)).toEqual([]);
    const cart = addToCart(addToCart([], by("FB-SNK-071")), by("FB-WAT-070"));
    expect(removeFromCart(cart, by("FB-SNK-071").id).map((r) => r.product.code)).toEqual(["FB-WAT-070"]);
  });
  test("«3,900 ฿»: whole baht, the final UI's money text", () => {
    expect(bahtText(390_000)).toBe("3,900 ฿");
  });
});

describe("the picker, rendered (the real Select, list forced open)", () => {
  const open = (searchValue: string) =>
    ui(<StockProductPicker products={all} onAdd={noop} selectProps={{ dropdownOpened: true, searchValue, comboboxProps: { withinPortal: false, keepMounted: true } }} />);
  test("the list shows «CODE · name», the price and the balance of each product", () => {
    const html = open("");
    expect(html).toContain("MIL-IN-001 · Miller inline skate — Seaworld");
    expect(html).toContain("3,900 ฿");
    expect(html).toContain('data-picker-option="FB-SNK-071"');
  });
  test("typing «mil hel» leaves ONLY the Miller helmet in the list (the real component, not just the pure function)", () => {
    const html = open("mil hel");
    expect(html).toContain('data-picker-option="MIL-HEL-010"');
    for (const other of ["FB-SNK-071", "MIL-IN-001", "ANI-HEL-020", "OTH-SOC-081"]) expect(html).not.toContain(`data-picker-option="${other}"`);
  });
  test("a search with no hit says «No product found»", () => {
    expect(open("zzzz")).toContain("No product found");
  });
  test("the sold-out Sock is in the list but disabled", () => {
    const html = open("sock");
    expect(html).toContain('data-picker-option="OTH-SOC-081"');
    expect(html).toMatch(/data-combobox-disabled="true"|aria-disabled="true"|data-disabled="true"/);
  });
  test("the picker uses the shared filter (a source pin: Mantine's one-substring default would not find «mil hel»)", () => {
    const src = readFileSync("src/components/partials/Stock/StockProductPicker.tsx", "utf8");
    expect(src).toContain("filter={filter}");
    expect(src).toContain("matchesQuery(p, search)");
  });
});

describe("the host with the cart stub", () => {
  test("starts with an empty cart (no table) and the picker; with no products it says «No product found»", () => {
    const html = ui(<StockOutPickerBody products={all} />);
    expect(html).not.toContain("data-cart-stub");
    expect(html).toContain("Product");
    expect(ui(<StockOutPickerBody products={[]} />)).toContain("No product found");
  });
});

// ---- the API branch (TASK-904's GET /v1/stock/products) and the page rule ----
const realAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = realAdapter;
  STOCK_SOURCE.products = "fixture";
});
function stub(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
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
const WIRE = [
  { id: "b", code: "B-2", name: "Beta", category: "Other", priceSatang: 5_000, quantity: 3, commissionGroup: null, active: true },
  { id: "a", code: "A-1", name: "Alpha", category: "Other", priceSatang: 12_050, quantity: 0, commissionGroup: { name: "G", amountSatang: 4_000 }, active: true },
  { id: "z", code: "Z-9", name: "Zeta (retired)", category: "Other", priceSatang: 1, quantity: 1, commissionGroup: null, active: false },
];

describe("the API branch (flipped to \"api\" — what the wiring will do)", () => {
  test("GET /v1/stock/products with no params; ACTIVE only, by name; the sold-out one stays; satang as sent", async () => {
    STOCK_SOURCE.products = "api";
    const seen = stub(() => ({ status: 200, data: WIRE }));
    const rows = await listStockProducts("ceo");
    expect(seen.map((c) => `${c.method?.toUpperCase()} ${c.url}`)).toEqual(["GET /v1/stock/products"]);
    expect(seen[0].params).toBeUndefined();
    expect(codes(rows)).toEqual(["A-1", "B-2"]);
    expect(rows[0].priceSatang).toBe(12_050);
    expect(rows[0].quantity).toBe(0);
  });
  test("a product with no category tag (the real route's `category: null`) reads as an empty string, never null", async () => {
    STOCK_SOURCE.products = "api";
    stub(() => ({ status: 200, data: [{ ...WIRE[0], category: null }] }));
    const rows = await listStockProducts("ceo");
    expect(rows[0].category).toBe("");
  });
  test("a search term goes as ?q=; a Coach never makes the request; a non-array body is an empty list, not a crash", async () => {
    STOCK_SOURCE.products = "api";
    const seen = stub(() => ({ status: 200, data: { oops: true } }));
    expect(await listStockProducts("admin", "alp")).toEqual([]);
    expect(seen[0].params).toEqual({ q: "alp" });
    seen.length = 0;
    expect(await listStockProducts("coach")).toEqual([]);
    expect(seen).toEqual([]);
  });
});

describe("the page rule (PAGE_RULES, tagged TASK-905)", () => {
  const labels = (role: "ceo" | "admin" | "coach") => menuFor(role).flatMap((g) => g.items.map((i) => `${g.group}:${i.label}`));
  test("STOCK OUT is in the STOCK group for CEO and Admin, not for a Coach; /stock/out opens for the first two only", () => {
    expect(labels("ceo")).toContain("STOCK:STOCK OUT");
    expect(labels("admin")).toContain("STOCK:STOCK OUT");
    expect(labels("coach")).not.toContain("STOCK:STOCK OUT");
    expect(canOpen("ceo", "/stock/out")).toBe(true);
    expect(canOpen("admin", "/stock/out")).toBe(true);
    expect(canOpen("coach", "/stock/out")).toBe(false);
  });
});
