// TASK-912 — the Stock IN (receive) screen: product + quantity + date → STOCK_IN, on the fixture write seam (the BE write is folded into TASK-911). Run: `bun test src/components/partials/Stock`.
// 🚫 NO cost, NO price, NO profit (REQ-120 R3.2). Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { STOCK_SOURCE, StockWriteError, listStockProducts, receiveStock, resetStockFixture } from "@/services/stock.service";
import { canOpen, menuFor } from "@/lib/roles/pages";
import { balanceAfter, buildReceiveRequest, isReceivable, parseReceiveQty, validateReceive } from "./stock-in-logic";
import StockProductPicker from "./StockProductPicker";
import { StockInReceiveBody } from "./StockInReceive";
import type { StockInRequest, StockProduct } from "@/types/app/stock";

STOCK_SOURCE.products = "fixture"; // these tests run on the fixture (the shipped switches are "api"; the API branch is in stock-912-wire.test.tsx)
STOCK_SOURCE.stockIn = "fixture";
afterEach(() => {
  resetStockFixture();
  STOCK_SOURCE.products = "fixture";
  STOCK_SOURCE.stockIn = "fixture";
});

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const all = await listStockProducts("ceo");
const by = (code: string) => all.find((p) => p.code === code) as StockProduct;
const TODAY = "2026-11-09";
const req = (itemId: string, qty: number, key = "key-0001-aaaa"): StockInRequest => ({ idempotencyKey: key, receivedOn: TODAY, lines: [{ itemId, qty }] });
const now = async (code: string) => ((await listStockProducts("ceo")).find((p) => p.code === code) as StockProduct);
const noopReceive = async () => ({ receiptId: "r", movementsWritten: 1, receivedOn: TODAY });

describe("the form's rules (validateReceive / parseReceiveQty)", () => {
  test("quantity: a whole number above 0, digits only — «0», «-1», «1.5», «abc», empty are wrong", () => {
    expect(parseReceiveQty("12")).toBe(12);
    for (const bad of ["0", "-1", "1.5", "abc", "", "  "]) expect(parseReceiveQty(bad)).toBeNull();
  });
  test("a valid receive → { itemId, qty, receivedOn }; a missing product, quantity or date is reported and nothing is built", () => {
    const ok = validateReceive({ product: by("OTH-SOC-081"), qty: "5", receivedOn: "2026-11-08" }, TODAY);
    expect("ok" in ok && ok.ok).toEqual({ itemId: by("OTH-SOC-081").id, qty: 5, receivedOn: "2026-11-08" });
    const bad = validateReceive({ product: null, qty: "0", receivedOn: null }, TODAY);
    expect("errors" in bad && Object.keys(bad.errors).sort()).toEqual(["date", "product", "qty"]);
  });
  test("the date may be today or earlier, never in the future, and must be a real date", () => {
    for (const d of [TODAY, "2026-01-01"]) expect("ok" in validateReceive({ product: by("FB-SNK-071"), qty: "1", receivedOn: d }, TODAY)).toBe(true);
    for (const d of ["2026-11-10", "2026-02-30", "09/11/26"]) {
      const r = validateReceive({ product: by("FB-SNK-071"), qty: "1", receivedOn: d }, TODAY);
      expect("errors" in r && r.errors.date).toBe(true);
    }
  });
  test("a sold-out product CAN be received (that is the point); an inactive one cannot", () => {
    expect(isReceivable(by("OTH-SOC-081"))).toBe(true);
    expect(isReceivable({ active: false })).toBe(false);
    const r = validateReceive({ product: { ...by("FB-SNK-071"), active: false }, qty: "1", receivedOn: TODAY }, TODAY);
    expect("errors" in r && r.errors.product).toBe(true);
  });
});

describe("the request (buildReceiveRequest) — the shape of POST /v1/stock/in", () => {
  test("keys exactly idempotencyKey · receivedOn · lines; a line is exactly { itemId, qty } — NO cost, NO price, NO profit", () => {
    const r = buildReceiveRequest({ itemId: "i-1", qty: 4, receivedOn: TODAY }, "k-1");
    expect(Object.keys(r).sort()).toEqual(["idempotencyKey", "lines", "receivedOn"]);
    expect(r.lines).toEqual([{ itemId: "i-1", qty: 4 }]);
    expect(Object.keys(r.lines[0]).sort()).toEqual(["itemId", "qty"]);
    expect(JSON.stringify(r)).not.toMatch(/price|cost|profit|amount/i);
  });
  test("«Now in stock»: the balance plus the quantity typed (an unreadable quantity adds nothing)", () => {
    expect(balanceAfter({ quantity: 4 }, "6")).toBe(10);
    expect(balanceAfter({ quantity: 4 }, "abc")).toBe(4);
  });
});

describe("the fixture write seam (receiveStock)", () => {
  test("the balance goes UP — a sold-out Sock 0 → 5 — and the sale price is untouched", async () => {
    const before = await now("OTH-SOC-081");
    const res = await receiveStock("admin", req(before.id, 5));
    expect(Object.keys(res).sort()).toEqual(["movementsWritten", "receiptId", "receivedOn"]);
    expect(res.movementsWritten).toBe(1);
    const after = await now("OTH-SOC-081");
    expect([before.quantity, after.quantity]).toEqual([0, 5]);
    expect(after.priceSatang).toBe(before.priceSatang); // R3.2: a receive never touches the price
  });
  test("idempotent: the same key again adds nothing and answers the first result with alreadyApplied; a new key adds again", async () => {
    const id = by("FB-WAT-070").id; // 8 on hand
    const first = await receiveStock("ceo", req(id, 10, "same-key-1"));
    const again = await receiveStock("ceo", req(id, 10, "same-key-1"));
    expect(again).toEqual({ ...first, alreadyApplied: true });
    expect(first.alreadyApplied).toBeUndefined();
    expect((await now("FB-WAT-070")).quantity).toBe(18); // added ONCE
    await receiveStock("ceo", req(id, 10, "same-key-2"));
    expect((await now("FB-WAT-070")).quantity).toBe(28);
  });
  test("a quantity that is not a whole number above 0, an unknown product, a Coach: refused with the standard envelope", async () => {
    const id = by("FB-WAT-070").id;
    const bad = await receiveStock("ceo", req(id, 0)).then(() => null, (e: unknown) => e);
    expect(bad instanceof StockWriteError && bad.code).toBe("INVALID");
    const frac = await receiveStock("ceo", req(id, 1.5)).then(() => null, (e: unknown) => e);
    expect(frac instanceof StockWriteError && frac.code).toBe("INVALID");
    const missing = await receiveStock("ceo", req("nope", 1)).then(() => null, (e: unknown) => e);
    expect(missing instanceof StockWriteError && missing.code).toBe("NOT_FOUND");
    const forbidden = await receiveStock("coach", req(id, 1)).then(() => null, (e: unknown) => e);
    expect(forbidden instanceof StockWriteError && forbidden.code).toBe("FORBIDDEN");
    expect(missing instanceof StockWriteError && missing.body).toEqual({ error: { code: "NOT_FOUND", message: "Product not found", details: {} } });
    expect((await now("FB-WAT-070")).quantity).toBe(8); // none of the refusals wrote anything
  });
  test("the write is on the API switch (shipped \"api\", read from the service's source), and the receive screen imports no fixture", () => {
    expect(readFileSync("src/services/stock.service.ts", "utf8")).toContain('stockIn: "api"');
    for (const f of ["StockInReceive.tsx", "stock-in-logic.ts"]) expect(readFileSync(`src/components/partials/Stock/${f}`, "utf8")).not.toContain("__fixtures__");
  });
});

describe("the screen, rendered", () => {
  test("fields: Product · Quantity · Date, «Now in stock», Save — and NO price / cost / profit field anywhere", () => {
    const html = ui(<StockInReceiveBody products={all} onReceive={noopReceive} today={TODAY} />);
    for (const w of ["STOCK IN", "Product", "Quantity", "Date", "Now in stock:", "Save"]) expect(html).toContain(w);
    expect(html).not.toMatch(/Price|PRICE|Cost|COST|Profit|PROFIT/);
  });
  test("a picked product with a quantity shows the balance AFTER the receive (Sock 0 + 5 = 5); Save is open", () => {
    const html = ui(<StockInReceiveBody products={all} onReceive={noopReceive} today={TODAY} initial={{ product: by("OTH-SOC-081"), qty: "5" }} />);
    expect(html).toContain("Now in stock: 5");
    expect(html).not.toMatch(/data-save[^>]*disabled|disabled[^>]*data-save/);
  });
  test("Save is disabled with no product or no quantity", () => {
    const html = ui(<StockInReceiveBody products={all} onReceive={noopReceive} today={TODAY} />);
    expect(html).toMatch(/data-save[^>]*disabled|disabled[^>]*data-save/);
  });
  test("the picker, opened for a receive, lists the sold-out Sock as PICKABLE; for a sale it stays disabled", () => {
    const open = (pickable?: (p: StockProduct) => boolean) =>
      ui(<StockProductPicker products={all} onAdd={() => {}} pickable={pickable} selectProps={{ dropdownOpened: true, searchValue: "sock", comboboxProps: { withinPortal: false, keepMounted: true } }} />);
    const disabled = /data-combobox-disabled="true"|aria-disabled="true"|data-disabled="true"/;
    expect(open()).toMatch(disabled);
    expect(open(isReceivable)).not.toMatch(disabled);
  });
  test("the screen builds the request from the form through ONE key keeper (a source pin of the wiring)", () => {
    const src = readFileSync("src/components/partials/Stock/StockInReceive.tsx", "utf8");
    expect(src).toContain("buildReceiveRequest(r.ok, key.get())");
    expect(src).toContain("key.reset()");
    expect(src).toContain("maxDate={today}");
  });
});

describe("the page rule (PAGE_RULES, tagged TASK-912)", () => {
  const labels = (role: "ceo" | "admin" | "coach") => menuFor(role).flatMap((g) => g.items.map((i) => `${g.group}:${i.label}`));
  test("STOCK IN is in the STOCK group for CEO and Admin (receiving is not pay), not for a Coach; /stock/in opens for the first two only", () => {
    expect(labels("ceo")).toContain("STOCK:STOCK IN");
    expect(labels("admin")).toContain("STOCK:STOCK IN");
    expect(labels("coach")).not.toContain("STOCK:STOCK IN");
    expect(canOpen("ceo", "/stock/in")).toBe(true);
    expect(canOpen("admin", "/stock/in")).toBe(true);
    expect(canOpen("coach", "/stock/in")).toBe(false);
  });
});
