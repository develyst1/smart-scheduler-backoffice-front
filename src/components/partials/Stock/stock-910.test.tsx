// TASK-910 — the Stock OUT sell screen: picker → cart (qty · discount · commission by hand) → seller → Save, on the fixture write seam that pairs with TASK-909's `POST /v1/stock/out`.
// Run: `bun test src/components/partials/Stock`. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import type { InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import { NegativeBalanceError, STOCK_SOURCE, listSellers, listStockProducts, resetStockFixture, sellStockOut } from "@/services/stock.service";
import { DEFAULT_PAYMENT_METHOD, PAYMENT_METHOD_OPTIONS, addLine, buildSellRequest, cartIsValid, cartTotalSatang, checkLine, clampQty, createKeyKeeper, parseMoneyBox, removeLine, setLine, todayBkk, type SellLine } from "./stock-out-logic";
import { StockOutSellBody, refusalText } from "./StockOutSell";
import type { StockOutRequest, StockProduct } from "@/types/app/stock";

const realAdapter = api.defaults.adapter;
STOCK_SOURCE.products = "fixture"; // these tests run on the fixture (the shipped switches are "api"; the API branch is in stock-910-wire.test.tsx)
STOCK_SOURCE.out = "fixture";
afterEach(() => {
  resetStockFixture();
  api.defaults.adapter = realAdapter;
  STOCK_SOURCE.sellers = "api";
  STOCK_SOURCE.products = "fixture";
  STOCK_SOURCE.out = "fixture";
});
function stub(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  const seen: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    seen.push(config);
    const { status, data } = answer(config);
    return { status, data, statusText: "", headers: {}, config };
  };
  return seen;
}

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const all = await listStockProducts("ceo");
const by = (code: string) => all.find((p) => p.code === code) as StockProduct;
const line = (code: string, over: Partial<SellLine> = {}): SellLine => ({ product: by(code), qty: 1, discount: "", commission: "", ...over });
const req = (lines: StockOutRequest["lines"], key = "key-0001-aaaa"): StockOutRequest => ({ idempotencyKey: key, method: "TRANSFER", soldAt: "2026-11-09", lines });
const balance = async (code: string) => ((await listStockProducts("ceo")).find((p) => p.code === code) as StockProduct).quantity;
const noopSell = async () => ({ saleId: "s", movementsWritten: 1, soldAt: "2026-11-09" });

describe("the cart (addLine / removeLine / setLine / clampQty)", () => {
  test("a pick adds a line of qty 1; the same product again adds one, never above the balance; a sold-out one is refused", () => {
    const helmet = by("MIL-HEL-010"); // balance 4
    let cart = addLine([], helmet);
    for (let i = 0; i < 9; i++) cart = addLine(cart, helmet);
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(4);
    expect(addLine([], by("OTH-SOC-081"))).toEqual([]);
  });
  test("qty is a whole number from 1 up to the balance (0, negatives, decimals, NaN are pulled back)", () => {
    expect(clampQty(0, 4)).toBe(1);
    expect(clampQty(-3, 4)).toBe(1);
    expect(clampQty(2.9, 4)).toBe(2);
    expect(clampQty(99, 4)).toBe(4);
    expect(clampQty(Number.NaN, 4)).toBe(1);
    expect(setLine([line("MIL-HEL-010")], by("MIL-HEL-010").id, { qty: 99 })[0].qty).toBe(4);
  });
  test("Remove drops the line", () => {
    const cart = [line("FB-SNK-071"), line("FB-WAT-070")];
    expect(removeLine(cart, by("FB-SNK-071").id).map((l) => l.product.code)).toEqual(["FB-WAT-070"]);
  });
});

describe("the money boxes (parseMoneyBox / checkLine)", () => {
  test("empty = not sent; 0 ≤ number ≤ 2 decimals; «1.999», «-1», «abc» are invalid (no float)", () => {
    expect(parseMoneyBox("  ")).toBe("empty");
    expect(parseMoneyBox("12.5")).toEqual({ satang: 1_250 });
    for (const bad of ["1.999", "-1", "abc", "1,5"]) expect(parseMoneyBox(bad)).toBe("invalid");
  });
  test("line total = qty × price − discount, in integer satang (3 snacks at 50 ฿, discount 10.50 ฿ → 139.50 ฿)", () => {
    const c = checkLine(line("FB-SNK-071", { qty: 3, discount: "10.5" }));
    expect(c.totalSatang).toBe(13_950);
    expect(c.discountSatang).toBe(1_050);
    expect(c.errors).toEqual({});
  });
  test("a discount above the line's amount is wrong (red, nothing sent); the commission has NO rule beyond its shape — lower or raise, any amount", () => {
    expect(checkLine(line("FB-SNK-071", { discount: "50.01" })).errors.discount).toBe(true);
    expect(checkLine(line("FB-SNK-071", { discount: "50" })).errors.discount).toBeUndefined();
    expect(checkLine(line("FB-SNK-071", { commission: "99999" })).errors).toEqual({});
    expect(checkLine(line("FB-SNK-071", { commission: "0" })).commissionSatang).toBe(0);
    expect(checkLine(line("FB-SNK-071", { commission: "x" })).errors.commission).toBe(true);
  });
  test("the cart is valid only when it has a line and every line is; the total is the sum of the lines", () => {
    expect(cartIsValid([])).toBe(false);
    expect(cartIsValid([line("FB-SNK-071"), line("FB-WAT-070", { discount: "zzz" })])).toBe(false);
    const cart = [line("FB-SNK-071", { qty: 3 }), line("MIL-IN-001", { discount: "390" })];
    expect(cartIsValid(cart)).toBe(true);
    expect(cartTotalSatang(cart)).toBe(15_000 + 351_000);
  });
});

describe("the request (buildSellRequest) — the shape of POST /v1/stock/out", () => {
  test("keys exactly idempotencyKey · soldAt · sellerRefs · lines; a line has itemId · qty · unitPriceSatang, plus discount / commission ONLY when typed", () => {
    const r = buildSellRequest([line("MIL-IN-001", { discount: "390", commission: "50" }), line("FB-SNK-071", { qty: 3 })], ["seller-ton", "seller-ploy"], "k-1", "CASH", new Date("2026-11-09T05:00:00Z"));
    expect(Object.keys(r).sort()).toEqual(["idempotencyKey", "lines", "method", "sellerRefs", "soldAt"]);
    expect(r.method).toBe("CASH"); // REQUIRED (DECISIONS row 21): the revenue line's method is NOT NULL
    expect(r.idempotencyKey).toBe("k-1");
    expect(r.soldAt).toBe("2026-11-09");
    expect(r.sellerRefs).toEqual(["seller-ton", "seller-ploy"]);
    expect(r.lines[0]).toEqual({ itemId: by("MIL-IN-001").id, qty: 1, unitPriceSatang: 390_000, discountSatang: 39_000, commissionSatang: 5_000 });
    expect(r.lines[1]).toEqual({ itemId: by("FB-SNK-071").id, qty: 3, unitPriceSatang: 5_000 });
  });
  test("no seller picked ⇒ no sellerRefs key; soldAt is the Bangkok date (01:30 on the 10th at 18:30Z on the 9th)", () => {
    expect("sellerRefs" in buildSellRequest([line("FB-SNK-071")], [], "k", "TRANSFER")).toBe(false);
    expect(todayBkk(new Date("2026-11-09T18:30:00Z"))).toBe("2026-11-10");
  });
  test("the commission is sent as typed — NO commission maths: not defaulted from the group, not split among the sellers", () => {
    const r = buildSellRequest([line("MIL-IN-001")], ["a", "b", "c"], "k", "TRANSFER");
    expect("commissionSatang" in r.lines[0]).toBe(false); // untouched box ⇒ nothing sent (the product has a group; still nothing is derived)
    const typed = buildSellRequest([line("MIL-IN-001", { commission: "30" })], ["a", "b", "c"], "k", "TRANSFER");
    expect(typed.lines[0].commissionSatang).toBe(3_000); // one number, whole, for the line — not ÷ 3
  });
});

describe("one idempotency key per confirmed cart (createKeyKeeper)", () => {
  test("the same key on a second press; a new one after reset (an edit, or a success)", () => {
    let n = 0;
    const k = createKeyKeeper(() => `key-${++n}`);
    expect([k.get(), k.get()]).toEqual(["key-1", "key-1"]);
    k.reset();
    expect(k.get()).toBe("key-2");
  });
});

describe("the fixture write seam (sellStockOut)", () => {
  test("each line leaves stock once; the answer is { saleId, movementsWritten, soldAt } and NOTHING else (no totals — R0)", async () => {
    const before = await balance("MIL-HEL-010");
    const res = await sellStockOut("admin", req([{ itemId: by("MIL-HEL-010").id, qty: 2, unitPriceSatang: 129_000 }, { itemId: by("FB-SNK-071").id, qty: 3, unitPriceSatang: 5_000 }]));
    expect(Object.keys(res).sort()).toEqual(["movementsWritten", "saleId", "soldAt"]);
    expect(res.movementsWritten).toBe(2);
    expect(await balance("MIL-HEL-010")).toBe(before - 2);
    expect(await balance("FB-SNK-071")).toBe(21 - 3);
  });
  test("a line that would drive a balance below 0 refuses the WHOLE sale: nothing written, balances unchanged, the error names the model and the product", async () => {
    const err = await sellStockOut("ceo", req([{ itemId: by("FB-SNK-071").id, qty: 1, unitPriceSatang: 5_000 }, { itemId: by("MIL-HEL-010").id, qty: 5, unitPriceSatang: 129_000 }])).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err instanceof NegativeBalanceError).toBe(true);
    const e = err as NegativeBalanceError;
    expect([e.code, e.model, e.productName, e.resultingBalance]).toEqual(["NEGATIVE_BALANCE", "MIL-HEL-010", "Miller helmet — M", -1]);
    // the app's standard ENVELOPE (Sober): error.code / error.message / error.details
    expect(e.body).toEqual({ error: { code: "NEGATIVE_BALANCE", message: e.message, details: { model: "MIL-HEL-010", name: "Miller helmet — M", resultingBalance: -1 } } });
    expect(await balance("FB-SNK-071")).toBe(21); // the first, valid line was NOT sold either
    expect(await balance("MIL-HEL-010")).toBe(4);
  });
  test("two lines of the same product count together against the balance", async () => {
    const id = by("MIL-HEL-010").id;
    const err = await sellStockOut("ceo", req([{ itemId: id, qty: 3, unitPriceSatang: 1 }, { itemId: id, qty: 2, unitPriceSatang: 1 }])).then(() => null, (x: unknown) => x);
    expect(err instanceof NegativeBalanceError).toBe(true);
  });
  test("idempotent: the same key again writes nothing and answers the first result with alreadyApplied", async () => {
    const r = req([{ itemId: by("FB-WAT-070").id, qty: 2, unitPriceSatang: 2_000 }], "same-key-1");
    const first = await sellStockOut("ceo", r);
    const again = await sellStockOut("ceo", r);
    expect(again).toEqual({ ...first, alreadyApplied: true });
    expect(first.alreadyApplied).toBeUndefined();
    expect(await balance("FB-WAT-070")).toBe(8 - 2); // sold ONCE
    const other = await sellStockOut("ceo", { ...r, idempotencyKey: "same-key-2" });
    expect(other.saleId).not.toBe(first.saleId);
    expect(await balance("FB-WAT-070")).toBe(8 - 4);
  });
  test("a Coach cannot sell; an unknown product is NOT_FOUND; sellers: invented names for CEO / Admin, nobody for a Coach", async () => {
    const forbidden = await sellStockOut("coach", req([{ itemId: "x", qty: 1, unitPriceSatang: 1 }])).then(() => null, (e: unknown) => e);
    expect((forbidden as { code: string }).code).toBe("FORBIDDEN");
    const missing = await sellStockOut("ceo", req([{ itemId: "nope", qty: 1, unitPriceSatang: 1 }])).then(() => null, (e: unknown) => e);
    expect((missing as { code: string }).code).toBe("NOT_FOUND");
    expect(await listSellers("coach")).toEqual([]); // no request, whatever the switch says
  });
  test("sellers on the fixture switch: invented names for CEO / Admin", async () => {
    STOCK_SOURCE.sellers = "fixture";
    expect((await listSellers("admin")).length).toBeGreaterThan(0);
  });
  test("sellers from the API (Sober Q1): the EXISTING GET /v1/salary/entries/people, «No Teacher» left out, id = the teacher id, by name", async () => {
    const seen = stub(() => ({
      status: 200,
      data: [
        { teacherId: "t-2", name: "พลอย", meritEligible: false },
        { teacherId: "t-sys", name: "No Teacher", isSystem: true },
        { teacherId: "t-1", name: "ต้น", meritEligible: true },
      ],
    }));
    const rows = await listSellers("admin");
    expect(seen.map((c) => `${c.method?.toUpperCase()} ${c.url}`)).toEqual(["GET /v1/salary/entries/people"]);
    expect(rows.map((r) => r.id).sort()).toEqual(["t-1", "t-2"]);
    expect(rows.some((r) => r.name === "No Teacher")).toBe(false);
    expect(STOCK_SOURCE.sellers).toBe("api"); // the default: the route is live (TASK-886)
  });
  test("the write is on the API switch (shipped \"api\", read from the service's source), and the sell screen imports no fixture", () => {
    expect(readFileSync("src/services/stock.service.ts", "utf8")).toContain('out: "api"');
    for (const f of ["StockOutSell.tsx", "stock-out-logic.ts"]) expect(readFileSync(`src/components/partials/Stock/${f}`, "utf8")).not.toContain("__fixtures__");
  });
});

describe("the screen, rendered (R0 and the form)", () => {
  const cart = () => [line("FB-SNK-071", { qty: 3 }), line("MIL-IN-001", { discount: "390", commission: "50" })];
  const sellers = [{ id: "seller-ton", name: "Ton" }];
  test("CEO: each line's price, a LINE total and the cart TOTAL (3,660 + 150 − …); the columns; the seller pick; Save", () => {
    const html = ui(<StockOutSellBody products={all} sellers={sellers} role="ceo" onSell={noopSell} initialCart={cart()} />);
    for (const w of ["MODEL CODE", "PRODUCT NAME", "PRICE", "QTY", "DISCOUNT", "COMMISSION", "LINE", "Seller", "Save", "data-cart-total"]) expect(html).toContain(w);
    expect(html).toContain("3,510 ฿"); // the Miller skate line: 3,900 − 390
    expect(html).toContain("150 ฿"); // 3 snacks
    expect(html).toContain("3,660 ฿"); // the cart total
  });
  test("Admin: the same lines and the commission box, but NO cart total (R0 — no revenue aggregate)", () => {
    const html = ui(<StockOutSellBody products={all} sellers={sellers} role="admin" onSell={noopSell} initialCart={cart()} />);
    expect(html).toContain("3,510 ฿");
    expect(html).toContain("COMMISSION");
    expect(html).not.toContain("data-cart-total");
    expect(html).not.toContain("3,660 ฿");
    expect(html).not.toMatch(/>Total</);
  });
  test("Save is disabled while a box is wrong; an empty screen shows the picker and no cart", () => {
    const bad = ui(<StockOutSellBody products={all} sellers={sellers} role="ceo" onSell={noopSell} initialCart={[line("FB-SNK-071", { discount: "oops" })]} />);
    expect(bad).toMatch(/data-save[^>]*disabled|disabled[^>]*data-save/);
    const empty = ui(<StockOutSellBody products={all} sellers={sellers} role="ceo" onSell={noopSell} />);
    expect(empty).not.toContain("data-cart");
    expect(empty).toContain("Product");
  });
  test("the refusal's sentence names the item and says nothing was sold", () => {
    expect(refusalText("MIL-HEL-010", "Miller helmet — M")).toBe("Not enough stock for MIL-HEL-010 (Miller helmet — M) — nothing was sold");
  });
  test("the screen sends through ONE key keeper and builds the request from the cart (a source pin of the wiring)", () => {
    const src = readFileSync("src/components/partials/Stock/StockOutSell.tsx", "utf8");
    expect(src).toContain("buildSellRequest(cart, sellerIds, key.get(), method)");
    expect(src).toContain("key.reset()");
    expect(src).toContain("ceo && (");
  });
});

describe("the payment method (TASK-910 change, DECISIONS row 21) — REQUIRED, default Transfer", () => {
  test("the options are Transfer / Cash / Credit card with the values TRANSFER · CASH · CARD (909's enum); the default is Transfer", () => {
    expect(PAYMENT_METHOD_OPTIONS.map((o) => o.value)).toEqual(["TRANSFER", "CASH", "CARD"]);
    expect(PAYMENT_METHOD_OPTIONS.map((o) => o.label)).toEqual(["Transfer", "Cash", "Credit card"]);
    expect(DEFAULT_PAYMENT_METHOD).toBe("TRANSFER");
  });
  test("the request always carries the method", () => {
    for (const m of ["TRANSFER", "CASH", "CARD"] as const) expect(buildSellRequest([line("FB-SNK-071")], [], "k", m).method).toBe(m);
  });
  test("the seam refuses a sale with no method — METHOD_REQUIRED in the standard envelope — and writes nothing", async () => {
    const bad = { ...req([{ itemId: by("FB-SNK-071").id, qty: 1, unitPriceSatang: 5_000 }]), method: undefined } as unknown as StockOutRequest;
    const e = await sellStockOut("ceo", bad).then(() => null, (x: unknown) => x);
    expect((e as { code: string }).code).toBe("METHOD_REQUIRED");
    expect((e as { body: unknown }).body).toEqual({ error: { code: "METHOD_REQUIRED", message: "Payment method is required", details: {} } });
    expect(await balance("FB-SNK-071")).toBe(21);
    const wrong = { ...bad, method: "BITCOIN" } as unknown as StockOutRequest;
    const e2 = await sellStockOut("ceo", wrong).then(() => null, (x: unknown) => x);
    expect((e2 as { code: string }).code).toBe("METHOD_REQUIRED");
  });
  test("the screen: a «Payment Method» select pre-filled with Transfer; Save is open — and CLOSED when the field is cleared", () => {
    const cart = [line("FB-SNK-071")];
    const filled = ui(<StockOutSellBody products={all} sellers={[]} role="ceo" onSell={noopSell} initialCart={cart} />);
    expect(filled).toContain("Payment Method");
    expect(filled).toContain('value="Transfer"');
    expect(filled).not.toMatch(/data-save[^>]*disabled|disabled[^>]*data-save/);
    const cleared = ui(<StockOutSellBody products={all} sellers={[]} role="ceo" onSell={noopSell} initialCart={cart} initialMethod={null} />);
    expect(cleared).toMatch(/data-save[^>]*disabled|disabled[^>]*data-save/);
  });
});
