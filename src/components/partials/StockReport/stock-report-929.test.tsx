// TASK-929 — Stock Report: the Sales History + Balance tabs (the fixture seam; the real reads are TASK-928's `/v1/stock/sales` and 904's products).
// Run: `bun test src/components/partials/StockReport`. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { listStockBalances, listStockMovements, listStockSales } from "@/services/stock-report.service";
import { listStockProducts, resetStockFixture } from "@/services/stock.service";
import { BalanceTable, MovementTable, SalesTable } from "./StockReport";
import { ALL_CUSTOMERS, customerLabel, customerOptions, paymentWord } from "./sales-logic";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
afterEach(() => resetStockFixture());

describe("Sales History", () => {
  test("the period is inclusive at both ends and newest first", async () => {
    const { items } = await listStockSales("ceo", { from: "2026-10-31", to: "2026-11-03" });
    expect(items.map((r) => r.occurredOn)).toEqual(["2026-11-03", "2026-10-31"]);
    expect((await listStockSales("ceo", { from: "2026-11-09", to: "2026-11-09" })).items).toHaveLength(2);
  });

  test("the customers list is the WINDOW's distinct buyers (not only the filtered rows), by name; a no-buyer sale adds none", async () => {
    const all = await listStockSales("ceo", { from: "2026-10-01", to: "2026-11-30" });
    expect(all.customers).toEqual(["Khun Mali", "Khun Ton"]);
    const one = await listStockSales("ceo", { from: "2026-10-01", to: "2026-11-30", customer: "Khun Mali" });
    expect(one.items.every((r) => r.customer === "Khun Mali")).toBe(true);
    expect(one.items).toHaveLength(2);
    expect(one.customers).toEqual(["Khun Mali", "Khun Ton"]); // the select keeps offering everyone of the window
  });

  test("the columns are Date · Product · Qty · Customer · Payment — and no money anywhere", async () => {
    const html = ui(<SalesTable rows={(await listStockSales("ceo", { from: "2026-10-01", to: "2026-11-30" })).items} />);
    for (const h of ["DATE", "PRODUCT", "QTY", "CUSTOMER", "PAYMENT"]) expect(html).toContain(h);
    expect(html).toContain("09/11/26");
    expect(html).not.toMatch(/PRICE|AMOUNT|TOTAL|฿/);
  });

  test("payment shows as a word (CASH → Cash, TRANSFER → Transfer, CARD → Card); none is a dash; an unknown value is shown as it came", () => {
    expect(paymentWord("CASH")).toBe("Cash");
    expect(paymentWord("TRANSFER")).toBe("Transfer");
    expect(paymentWord("CARD")).toBe("Card");
    expect(paymentWord(null)).toBe("—");
    expect(paymentWord("QR")).toBe("QR");
    const html = ui(<SalesTable rows={[{ id: "a", saleId: "s", occurredOn: "2026-11-09", itemId: "i", code: "", name: "Helmet", qty: 1, customer: "Khun Ton", payment: "TRANSFER", branch: "BRAVO" }]} />);
    expect(html).toContain("Transfer");
    expect(html).not.toContain("TRANSFER");
  });

  test('a sale with no buyer reads "Walk-in"', async () => {
    expect(customerLabel(null)).toBe("Walk-in");
    expect(customerLabel("  ")).toBe("Walk-in");
    expect(customerLabel("Khun Ton")).toBe("Khun Ton");
    const { items } = await listStockSales("ceo", { from: "2026-10-15", to: "2026-10-15" });
    const html = ui(<SalesTable rows={items} />);
    expect(html).toContain("Walk-in");
    expect(html).toContain('data-customer="walk-in"');
  });

  test("the Customer select offers All first, then the buyers", () => {
    expect(customerOptions(["Khun Ton", "Khun Mali"])).toEqual([
      { value: ALL_CUSTOMERS, label: "All" },
      { value: "Khun Mali", label: "Khun Mali" },
      { value: "Khun Ton", label: "Khun Ton" },
    ]);
  });

  test("an empty period says so, in the final UI's words; a Coach gets nothing", async () => {
    expect(ui(<SalesTable rows={[]} />)).toContain("No sales in this period");
    expect(await listStockSales("coach", { from: "2026-10-01", to: "2026-11-30" })).toEqual({ items: [], customers: [] });
  });
});

describe("Balance", () => {
  test("Product · Balance, from the products read (current quantity), by name; no Location, no From/To", async () => {
    const rows = await listStockBalances("ceo");
    const products = await listStockProducts("ceo");
    expect(rows.map((r) => [r.name, r.quantity])).toEqual(products.map((p) => [p.name, p.quantity]));
    const html = ui(<BalanceTable rows={rows} />);
    expect(html).toContain("PRODUCT");
    expect(html).toContain("BALANCE");
    expect(html).not.toMatch(/LOCATION|FROM|>TO</);
    expect(html).toContain(`data-balance="${rows[0].quantity}"`);
  });

  test("a sold-out product stays on the list with 0; an empty list says so; a Coach gets nothing", async () => {
    const rows = await listStockBalances("admin");
    expect(rows.some((r) => r.quantity === 0)).toBe(true);
    expect(ui(<BalanceTable rows={[]} />)).toContain("No products yet");
    expect(await listStockBalances("coach")).toEqual([]);
  });
});

describe("the shell", () => {
  test("Movement still works (Flash's tab is intact)", async () => {
    const rows = await listStockMovements("ceo", { from: "2026-11-01", to: "2026-11-09" });
    expect(rows.length).toBe(6);
    expect(ui(<MovementTable rows={rows} />)).toContain("Stock in");
  });

  test("the 'coming in a follow-on TASK' note is gone; both tabs read their data hooks", () => {
    const src = readFileSync("src/components/partials/StockReport/StockReport.tsx", "utf8");
    expect(src).not.toContain("is coming in a follow-on TASK");
    expect(src).toContain("useStockSales");
    expect(src).toContain("useStockBalances");
  });

  test("no new PAGE_RULES row (906's /stock/reports covers it) and no search/type filter on the new tabs (REQ-5010 #19 stays parked)", () => {
    const rules = readFileSync("src/lib/roles/pages.ts", "utf8");
    expect(rules.match(/href: "\/stock\/reports"/g)).toHaveLength(1);
    const src = readFileSync("src/components/partials/StockReport/StockReport.tsx", "utf8");
    const salesPanel = src.slice(src.indexOf('<Tabs.Panel value="sales"'), src.indexOf('<Tabs.Panel value="movement"'));
    expect(salesPanel).not.toMatch(/TextInput|placeholder="Search/);
  });
});
