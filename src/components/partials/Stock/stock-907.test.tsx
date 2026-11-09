// TASK-907 — the Stock Product page (list · category tabs · add / edit) on the 904 fixture seam. Run: `bun test src/components/partials/Stock`.
// Each test names the code whose removal makes it fail. The writes run on the in-memory fixture only (no write route is defined yet).
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { StockWriteError, createStockProduct, listStockProducts, resetStockFixture, updateStockProduct } from "@/services/stock.service";
import { canOpen, menuFor } from "@/lib/roles/pages";
import { StockProductsBody } from "./StockProducts";
import { ProductFormBody, productFormTitle } from "./ProductFormModal";
import { bahtTextToSatang, categoriesOf, commissionText, draftOf, emptyDraft, filterByCategory, satangToInput, validateProductForm } from "./stock-product-logic";
import type { StockProduct } from "@/types/app/stock";

afterEach(() => resetStockFixture());

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const noop = async () => {};
const everything = () => listStockProducts("ceo", undefined, { includeInactive: true });
const codes = (xs: StockProduct[]) => xs.map((p) => p.code);

describe("the list (listStockProducts with includeInactive)", () => {
  test("the Product page sees the inactive product too; the picker's default read still does not", async () => {
    expect((await everything()).length).toBe(12);
    expect(codes(await listStockProducts("ceo")).includes("OLD-HEL-099")).toBe(false);
    expect(codes(await everything()).includes("OLD-HEL-099")).toBe(true);
  });
  test("a Coach gets nothing, even with includeInactive", async () => {
    expect(await listStockProducts("coach", undefined, { includeInactive: true })).toEqual([]);
  });
});

describe("categories and the filter (categoriesOf / filterByCategory)", () => {
  test("the tabs are the distinct categories A→Z; «All» (null) keeps every product, a tab keeps its own", async () => {
    const all = await everything();
    expect(categoriesOf(all)).toEqual(["Bike", "F&B", "Inlineskate", "Miller division", "Other", "Safety"]);
    expect(filterByCategory(all, null).length).toBe(12);
    expect(codes(filterByCategory(all, "Bike"))).toEqual(["BIK-BAL-050"]);
    expect(codes(filterByCategory(all, "F&B")).sort()).toEqual(["FB-SNK-071", "FB-WAT-070"]);
  });
});

describe("the page, rendered", () => {
  test("columns: MODEL CODE · CATEGORY · PRODUCT NAME · COMMISSION · PRICE · UNIT (REQ-5010 15a, never «QUANTITY») · ACTIVE; NO location / branch / transfer", async () => {
    const html = ui(<StockProductsBody products={await everything()} onCreate={noop} onUpdate={noop} />);
    for (const h of ["MODEL CODE", "CATEGORY", "PRODUCT NAME", "COMMISSION", "PRICE", "UNIT", "ACTIVE"]) expect(html).toContain(h);
    expect(html).not.toContain("QUANTITY");
    for (const w of ["LOCATION", "Location", "Branch", "Transfer", "Bravo"]) expect(html).not.toContain(w);
    expect(html).toContain("Add product");
  });
  test("a row prints code, name, category, commission «Miller skate —» (the group name; its amount lives on the group), price «3,900 ฿» and the balance; the sold-out Sock and the inactive helmet STAY listed", async () => {
    const html = ui(<StockProductsBody products={await everything()} onCreate={noop} onUpdate={noop} />);
    expect(html).toContain('data-product-row="MIL-IN-001"');
    expect(html).toContain("Miller skate —");
    expect(html).not.toContain("Miller skate 100");
    expect(html).toContain("3,900 ฿");
    expect(html).toContain('data-product-row="OTH-SOC-081"');
    expect(html).toContain('data-product-row="OLD-HEL-099"');
  });
  test("the tab bar has «All» and every category", async () => {
    const html = ui(<StockProductsBody products={await everything()} onCreate={noop} onUpdate={noop} />);
    for (const c of ["All", "Bike", "F&amp;B", "Inlineskate", "Miller division", "Other", "Safety"]) expect(html).toContain(`>${c}<`);
  });
  test("a page with no product says «No product found»", () => {
    expect(ui(<StockProductsBody products={[]} onCreate={noop} onUpdate={noop} />)).toContain("No product found");
  });
});

describe("the form's rules (validateProductForm)", () => {
  const ok = { ...emptyDraft("Bike"), code: "NEW-1", name: "New bike", price: "1290.5", commissionName: "Group A", openingQuantity: "6" };
  test("a valid new product → integer satang, commission group, the opening balance", () => {
    const r = validateProductForm(ok, true);
    expect("input" in r && r.input).toEqual({ code: "NEW-1", name: "New bike", category: "Bike", priceSatang: 129_050, commissionGroup: "Group A", active: true, openingQuantity: 6 }); // the write carries the group NAME only (TASK-911; Sober Q1b)
  });
  test("the commission is the group NAME only: empty = no commission, a name is sent as the string; there is no per-product amount (Sober Q1b)", () => {
    const none = validateProductForm({ ...ok, commissionName: "  " }, true);
    expect("input" in none && none.input.commissionGroup).toBeNull();
    const named = validateProductForm({ ...ok, commissionName: " Miller helmet " }, true);
    expect("input" in named && named.input.commissionGroup).toBe("Miller helmet");
    expect("commissionAmount" in emptyDraft()).toBe(false);
  });
  test("price: ≥ 0 with at most 2 decimals; «1.999», «-1», «abc», empty are wrong (nothing is sent)", () => {
    expect(bahtTextToSatang("0")).toBe(0);
    expect(bahtTextToSatang("1290.5")).toBe(129_050);
    for (const bad of ["1.999", "-1", "abc", "", "1,5"]) {
      const r = validateProductForm({ ...ok, price: bad }, true);
      expect("errors" in r && r.errors.price).toBe(true);
    }
  });
  test("code, name, category are required; the opening balance must be a whole number — on CREATE only (an edit ignores it and has no code)", () => {
    const r = validateProductForm({ ...ok, code: " ", name: "", category: "", openingQuantity: "1.5" }, true);
    expect("errors" in r && Object.keys(r.errors).sort()).toEqual(["category", "code", "name", "openingQuantity"]);
    const edit = validateProductForm({ ...ok, code: "", openingQuantity: "garbage" }, false);
    expect("input" in edit && "openingQuantity" in edit.input).toBe(false);
    expect("input" in edit && "code" in edit.input && edit.input.code).toBe("");
  });
  test("satang ↔ text round-trips without a float: 129050 → «1290.50», «1290.50» → 129050", () => {
    expect(satangToInput(129_050)).toBe("1290.50");
    expect(satangToInput(129_000)).toBe("1290");
    expect(commissionText({ name: "Miller skate", amountSatang: null })).toBe("Miller skate —");
    expect(commissionText({ name: "Miller skate", amountSatang: 10_000 })).toBe("Miller skate 100"); // once a group carries a rate
    expect(commissionText(null)).toBe("—");
  });
});

describe("add / edit round-trip on the fixture seam", () => {
  test("create: the product appears in the list with the opening balance; its Model code is unique (any case)", async () => {
    const made = await createStockProduct("admin", { code: "NEW-1", name: "New bike", category: "Bike", priceSatang: 129_050, commissionGroup: null, active: true, openingQuantity: 6 });
    const row = (await everything()).find((p) => p.id === made.id) as StockProduct;
    expect([row.code, row.quantity, row.priceSatang, row.commissionGroup]).toEqual(["NEW-1", 6, 129_050, null]);
    const dup = await createStockProduct("ceo", { code: "new-1", name: "Dup", category: "Bike", priceSatang: 1, commissionGroup: null, active: true }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(dup instanceof StockWriteError && dup.code).toBe("CODE_EXISTS");
  });
  test("edit: changes name / category / price / commission / active, NEVER the Model code or the balance", async () => {
    const before = (await everything()).find((p) => p.code === "MIL-HEL-010") as StockProduct;
    await updateStockProduct("ceo", before.id, { name: "Miller helmet — L", priceSatang: 150_000, commissionGroup: null, active: false, category: "Safety" });
    const after = (await everything()).find((p) => p.id === before.id) as StockProduct;
    expect([after.name, after.priceSatang, after.commissionGroup, after.active, after.category]).toEqual(["Miller helmet — L", 150_000, null, false, "Safety"]);
    expect([after.code, after.quantity]).toEqual([before.code, before.quantity]);
    expect(codes(await listStockProducts("ceo")).includes("MIL-HEL-010")).toBe(false); // inactive ⇒ off the picker
  });
  test("a Coach cannot write; an unknown id is NOT_FOUND", async () => {
    const forbidden = await createStockProduct("coach", { code: "X", name: "x", category: "c", priceSatang: 1, commissionGroup: null, active: true }).then(() => null, (e: unknown) => e);
    expect(forbidden instanceof StockWriteError && forbidden.code).toBe("FORBIDDEN");
    const missing = await updateStockProduct("ceo", "nope", { name: "x" }).then(() => null, (e: unknown) => e);
    expect(missing instanceof StockWriteError && missing.code).toBe("NOT_FOUND");
  });
  test("resetStockFixture puts the shipped data back (an add does not leak into the next test)", async () => {
    expect((await everything()).length).toBe(12);
  });
});

describe("the form, rendered", () => {
  const draftProduct = async () => (await everything()).find((p) => p.code === "MIL-HEL-010") as StockProduct;
  test("«Add product»: MODEL CODE · PRODUCT NAME · CATEGORY · PRICE · COMMISSION group + amount · UNIT · ACTIVE; no location", () => {
    const html = ui(<ProductFormBody product={null} categories={["Bike"]} onClose={() => {}} onSave={noop} />);
    for (const f of ['data-field="code"', 'data-field="name"', 'data-field="category"', 'data-field="price"', 'data-field="commissionName"', 'data-field="openingQuantity"', "ACTIVE"]) expect(html).toContain(f);
    expect(html).not.toContain('data-field="commissionAmount"'); // no per-product amount
    expect(productFormTitle(null)).toBe("Add product");
    expect(html).not.toMatch(/LOCATION|Location|BRANCH|Branch/);
  });
  test("«Edit product»: no MODEL CODE box (the identity) and no UNIT box (an edit never changes the balance), the draft carries the product's values", async () => {
    const p = await draftProduct();
    const html = ui(<ProductFormBody product={p} categories={["Bike"]} onClose={() => {}} onSave={noop} />);
    expect(productFormTitle(p)).toBe("Edit product");
    expect(html).not.toContain('data-field="code"');
    expect(html).not.toContain('data-field="openingQuantity"');
    expect(draftOf(p)).toMatchObject({ name: "Miller helmet — M", price: "1290", commissionName: "Miller helmet", active: true });
  });
});

describe("the page rule and the seam", () => {
  const labels = (role: "ceo" | "admin" | "coach") => menuFor(role).flatMap((g) => g.items.map((i) => `${g.group}:${i.label}`));
  test("Product is in the STOCK group for CEO and Admin, not for a Coach; /stock/products opens for the first two only", () => {
    expect(labels("ceo")).toContain("STOCK:Product");
    expect(labels("admin")).toContain("STOCK:Product");
    expect(labels("coach")).not.toContain("STOCK:Product");
    expect(canOpen("ceo", "/stock/products")).toBe(true);
    expect(canOpen("admin", "/stock/products")).toBe(true);
    expect(canOpen("coach", "/stock/products")).toBe(false);
  });
  test("the writes are fixture-only for now (no write shape is defined), and no component imports the fixture", () => {
    expect(readFileSync("src/services/stock.service.ts", "utf8")).toContain('writes: "fixture"');
    for (const f of ["StockProducts.tsx", "ProductFormModal.tsx", "StockData.ts", "stock-product-logic.ts"]) expect(readFileSync(`src/components/partials/Stock/${f}`, "utf8")).not.toContain("__fixtures__");
  });
});
