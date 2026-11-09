// TASK-913 — Low Stock view + per-type thresholds (REQ-120 R3.7) on the 904 products fixture and a thresholds fixture store. Run: `bun test src/components/partials/Stock`.
// Each test names the code whose removal makes it fail. The Monday message / its recipients are NOT here (a BE job tied to Notifications).
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { STOCK_SOURCE, StockWriteError, getLowStockThresholds, listStockProducts, resetStockFixture, setLowStockThresholds } from "@/services/stock.service";
import { canOpen, menuFor } from "@/lib/roles/pages";
import { DEFAULT_THRESHOLDS, draftOfThresholds, lowProducts, settingRows, thresholdOf, typeKeyFor, validateThresholds } from "./low-stock-logic";
import { LowStockBody } from "./LowStock";
import { categoriesOf } from "./stock-product-logic";
import type { StockProduct } from "@/types/app/stock";

afterEach(() => resetStockFixture());

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const everything = () => listStockProducts("ceo", undefined, { includeInactive: true });
const codes = (rows: { product: StockProduct }[]) => rows.map((r) => r.product.code);
const noopSave = async () => {};

describe("the defaults (R3.7)", () => {
  test("F&B 10 · Safety 1 · Miller 5 · Sock 1 · Shirt 1 — and nothing else (DEFAULT_THRESHOLDS)", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({ "F&B": 10, Safety: 1, Miller: 5, Sock: 1, Shirt: 1 });
  });
});

describe("which type a category falls under (typeKeyFor / thresholdOf)", () => {
  const keys = Object.keys(DEFAULT_THRESHOLDS);
  test("the same name in any case; «Miller division» falls under «Miller» (its first word); a category with no type has none", () => {
    expect(typeKeyFor("f&b", keys)).toBe("F&B");
    expect(typeKeyFor("Miller division", keys)).toBe("Miller");
    expect(typeKeyFor("Bike", keys)).toBeNull();
    expect(thresholdOf("Miller division", DEFAULT_THRESHOLDS)).toBe(5);
    expect(thresholdOf("Bike", DEFAULT_THRESHOLDS)).toBeNull();
  });
});

describe("the Low Stock rule (lowProducts): quantity ≤ the threshold of its type", () => {
  test("with the defaults: the Miller helmet (4 ≤ 5) and the Water (8 ≤ 10) are low; the Snack (21), the Miller skate (6) and the Safety helmet (9 > 1) are not", async () => {
    const low = lowProducts(await everything(), DEFAULT_THRESHOLDS);
    expect(codes(low).sort()).toEqual(["FB-WAT-070", "MIL-HEL-010"]);
    expect(low.find((l) => l.product.code === "MIL-HEL-010")).toMatchObject({ threshold: 5, under: 1 });
    expect(low.find((l) => l.product.code === "FB-WAT-070")).toMatchObject({ threshold: 10, under: 2 });
  });
  test("exactly AT the level is low (≤, not <); one above is not", () => {
    const p = (q: number): StockProduct => ({ id: "x", code: "X", name: "X", category: "Safety", priceSatang: 1, quantity: q, active: true });
    expect(lowProducts([p(1)], { Safety: 1 })).toHaveLength(1);
    expect(lowProducts([p(2)], { Safety: 1 })).toHaveLength(0);
  });
  test("a product at 0 is low whenever its type HAS a threshold (even 0); a type with NO threshold (null / absent) is never low", () => {
    const p: StockProduct = { id: "x", code: "X", name: "X", category: "Bike", priceSatang: 1, quantity: 0, active: true };
    expect(lowProducts([p], { Bike: 0 })).toHaveLength(1);
    expect(lowProducts([p], { Bike: null })).toHaveLength(0);
    expect(lowProducts([p], {})).toHaveLength(0);
  });
  test("an inactive product is never listed; the list is sorted by category, then how far under (most first)", async () => {
    const all = await everything();
    expect(lowProducts(all.map((x) => ({ ...x, active: false })), DEFAULT_THRESHOLDS)).toEqual([]);
    const low = lowProducts(all, { "F&B": 30, Miller: 5 });
    expect(codes(low)).toEqual(["FB-WAT-070", "FB-SNK-071", "MIL-HEL-010"]); // F&B before Miller; within F&B the one furthest under first (Water 30−8=22, then Snack 30−21=9)
  });
});

describe("the settings rows and the boxes (settingRows / validateThresholds)", () => {
  test("the customer's five types first, then each category that matches no type (so it can be given a level)", async () => {
    const rows = settingRows(categoriesOf(await everything()), DEFAULT_THRESHOLDS);
    expect(rows.map((r) => r.key)).toEqual(["F&B", "Safety", "Miller", "Sock", "Shirt", "Bike", "Inlineskate", "Other"]);
    expect(rows.find((r) => r.key === "Bike")?.value).toBeNull();
    expect(draftOfThresholds([{ key: "A", value: 3 }, { key: "B", value: null }])).toEqual({ A: "3", B: "" });
  });
  test("empty = no alert (null); a whole number ≥ 0 is kept; «-1», «1.5», «abc» are wrong and named", () => {
    const ok = validateThresholds({ A: "0", B: " 7 ", C: "" });
    expect("ok" in ok && ok.ok).toEqual({ A: 0, B: 7, C: null });
    const bad = validateThresholds({ A: "-1", B: "1.5", C: "abc", D: "2" });
    expect("errors" in bad && bad.errors).toEqual(["A", "B", "C"]);
  });
});

describe("the thresholds seam (fixture; getLowStockThresholds / setLowStockThresholds)", () => {
  test("starts at the defaults; a save round-trips and CHANGES the list (Water leaves when its level drops below its balance)", async () => {
    expect(await getLowStockThresholds("admin")).toEqual(DEFAULT_THRESHOLDS);
    const before = lowProducts(await everything(), await getLowStockThresholds("ceo"));
    expect(codes(before)).toContain("FB-WAT-070");
    await setLowStockThresholds("ceo", { ...DEFAULT_THRESHOLDS, "F&B": 5, Bike: 5 });
    const th = await getLowStockThresholds("ceo");
    expect(th["F&B"]).toBe(5);
    const after = lowProducts(await everything(), th);
    expect(codes(after)).not.toContain("FB-WAT-070"); // 8 > 5
    expect(codes(after)).toContain("BIK-BAL-050"); // the Bike type got a level: 5 ≤ 5
  });
  test("a bad level, an empty type name or a Coach is refused with the standard envelope; nothing is saved", async () => {
    for (const bad of [{ A: -1 }, { A: 1.5 }, { " ": 2 }] as Array<Record<string, number>>) {
      const e = await setLowStockThresholds("ceo", bad).then(() => null, (x: unknown) => x);
      expect(e instanceof StockWriteError && e.code).toBe("INVALID");
      expect(e instanceof StockWriteError && e.body.error.code).toBe("INVALID");
    }
    const forbidden = await setLowStockThresholds("coach", { A: 1 }).then(() => null, (x: unknown) => x);
    expect(forbidden instanceof StockWriteError && forbidden.code).toBe("FORBIDDEN");
    expect(await getLowStockThresholds("coach")).toEqual({});
    expect(await getLowStockThresholds("ceo")).toEqual(DEFAULT_THRESHOLDS);
  });
  test("the store is behind the fixture switch, the screen imports no fixture, and resetStockFixture puts the defaults back", async () => {
    expect(STOCK_SOURCE.writes).toBe("fixture");
    for (const f of ["LowStock.tsx", "low-stock-logic.ts"]) expect(readFileSync(`src/components/partials/Stock/${f}`, "utf8")).not.toContain("__fixtures__");
    await setLowStockThresholds("ceo", { X: 9 });
    resetStockFixture();
    expect(await getLowStockThresholds("ceo")).toEqual(DEFAULT_THRESHOLDS);
  });
});

describe("the screen, rendered", () => {
  test("Setting: a box per type with «Alert (Unit)»; the list: MODEL CODE · PRODUCT NAME · CATEGORY · UNIT · Alert (Unit) · Under by, the «2 low» badge — and NO price / revenue / recipients / Monday message", async () => {
    const html = ui(<LowStockBody products={await everything()} thresholds={DEFAULT_THRESHOLDS} onSave={noopSave} />);
    for (const w of ["Low Stock", "Setting", "Type", "Alert (Unit)", "MODEL CODE", "PRODUCT NAME", "CATEGORY", "UNIT", "Under by", "2 low", 'data-low-row="MIL-HEL-010"', 'data-low-row="FB-WAT-070"', "Save"]) expect(html).toContain(w);
    for (const type of ["F&amp;B", "Safety", "Miller", "Sock", "Shirt"]) expect(html).toContain(`data-type-row="${type}"`);
    expect(html).not.toContain('data-low-row="FB-SNK-071"');
    expect(html).not.toMatch(/PRICE|Price|฿|Monday|Send a test|Recipient|\bTo\b/);
  });
  test("nothing under its level shows the empty line", async () => {
    const html = ui(<LowStockBody products={await everything()} thresholds={{}} onSave={noopSave} />);
    expect(html).toContain("0 low");
    expect(html).toContain("No product is low");
  });
});

describe("the page rule (PAGE_RULES, tagged TASK-913)", () => {
  const labels = (role: "ceo" | "admin" | "coach") => menuFor(role).flatMap((g) => g.items.map((i) => `${g.group}:${i.label}`));
  test("Low Stock is in the STOCK group for CEO and Admin, not a Coach; /stock/low opens for the first two only", () => {
    expect(labels("ceo")).toContain("STOCK:Low Stock");
    expect(labels("admin")).toContain("STOCK:Low Stock");
    expect(labels("coach")).not.toContain("STOCK:Low Stock");
    expect(canOpen("admin", "/stock/low")).toBe(true);
    expect(canOpen("coach", "/stock/low")).toBe(false);
  });
});
