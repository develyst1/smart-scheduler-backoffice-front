// TASK-906 — Stock Report shell (the typed fixture seam; the real reader waits on Sober's Q1). Run: `bun test src/components/partials/StockReport`.
// Each test names the code whose removal makes it fail.
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { STOCK_REPORT_SOURCE, listStockMovements } from "@/services/stock-report.service";
import { PAGE_RULES, canOpen } from "@/lib/roles/pages";
import { MAX_PERIOD_DAYS, periodOf, periodProblem } from "./period";
import { MovementTable } from "./StockReport";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("the seam (listStockMovements)", () => {
  test("it still answers from the fixture: the wiring TASK flips this one constant", () => {
    expect(STOCK_REPORT_SOURCE).toBe("fixture");
  });
  test("both ends of the period are inclusive, newest first", async () => {
    const rows = await listStockMovements("ceo", { from: "2026-11-01", to: "2026-11-09" });
    expect(rows.length).toBe(6);
    expect(rows[0].occurredOn).toBe("2026-11-09");
    expect(rows.at(-1)?.occurredOn).toBe("2026-11-01");
    const sorted = [...rows.map((r) => r.occurredOn)].sort().reverse();
    expect(rows.map((r) => r.occurredOn)).toEqual(sorted);
  });
  test("a one-day period holds only that day", async () => {
    const rows = await listStockMovements("admin", { from: "2026-11-09", to: "2026-11-09" });
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.occurredOn === "2026-11-09")).toBe(true);
  });
  test("the Type filter narrows the rows", async () => {
    const rows = await listStockMovements("ceo", { from: "2026-10-01", to: "2026-11-30", type: "STOCK_IN" });
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.type === "STOCK_IN")).toBe(true);
  });
  test("a Coach gets nothing (hidden, never masked)", async () => {
    expect(await listStockMovements("coach", { from: "2026-10-01", to: "2026-11-30" })).toEqual([]);
  });
  test("it hands out copies: editing a result does not change the next answer", async () => {
    const a = await listStockMovements("ceo", { from: "2026-11-09", to: "2026-11-09" });
    a[0].qty = 999;
    const b = await listStockMovements("ceo", { from: "2026-11-09", to: "2026-11-09" });
    expect(ids(a)).toEqual(ids(b));
    expect(b.some((r) => r.qty === 999)).toBe(false);
  });
  test("no row carries money (the final UI: no revenue amounts here)", async () => {
    const rows = await listStockMovements("ceo", { from: "2026-10-01", to: "2026-11-30" });
    expect(rows.every((r) => !("valueMinor" in r) && !("amountMinor" in r))).toBe(true);
  });
});

describe("the period filter", () => {
  test("Day is the one date; Month is the whole calendar month of it", () => {
    expect(periodOf("day", "2026-11-09")).toEqual({ from: "2026-11-09", to: "2026-11-09" });
    expect(periodOf("month", "2026-11-09")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodOf("month", "2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  test("Custom keeps the range it had", () => {
    expect(periodOf("custom", "2026-11-09", { from: "2026-10-05", to: "2026-10-20" })).toEqual({ from: "2026-10-05", to: "2026-10-20" });
  });
  test("a good range has no problem; From after To, a missing date and a range over 366 days do", () => {
    expect(periodProblem({ from: "2026-11-01", to: "2026-11-01" })).toBeNull();
    expect(periodProblem({ from: "2026-01-01", to: "2026-12-31" })).toBeNull();
    expect(periodProblem({ from: "2026-11-02", to: "2026-11-01" })).toContain("From");
    expect(periodProblem({ from: "", to: "2026-11-01" })).toContain("both dates");
    expect(MAX_PERIOD_DAYS).toBe(366);
    expect(periodProblem({ from: "2025-01-01", to: "2026-01-02" })).toContain("366");
  });
});

describe("MovementTable", () => {
  test("shows Date · Type · Product · Qty, +n green and −n red, no money column", async () => {
    const rows = await listStockMovements("ceo", { from: "2026-11-09", to: "2026-11-09" });
    const html = ui(<MovementTable rows={rows} />);
    for (const h of ["DATE", "TYPE", "PRODUCT", "QTY"]) expect(html).toContain(h);
    expect(html).toContain("−1");
    expect(html).toContain("Sale");
    expect(html).not.toMatch(/PRICE|AMOUNT|฿/);
    const stockIn = ui(<MovementTable rows={(await listStockMovements("ceo", { from: "2026-11-05", to: "2026-11-05" }))} />);
    expect(stockIn).toContain("+6");
    expect(stockIn).toContain("Stock in");
  });
  test("an empty period says so, in its own words", () => {
    expect(ui(<MovementTable rows={[]} />)).toContain("No movement in this period");
  });
  // TASK-929 wired Sales History and Balance; the "coming in a follow-on TASK" note (and its test) is gone. Their tests are in stock-report-929.test.tsx.
});

describe("the route and the gate (Sober's Q3)", () => {
  test("only /stock/reports mounts the Stock Report, and PAGE_RULES lets CEO and Admin (not a Coach) in, with no money flag", () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
    const mounts = walk("src/app").filter((f) => /page\.tsx$/.test(f) && readFileSync(f, "utf8").includes("StockReport"));
    expect(mounts.map((f) => f.replace(/\\/g, "/"))).toEqual(["src/app/(admin)/stock/reports/page.tsx"]);
    const rule = PAGE_RULES.find((p) => p.href === "/stock/reports");
    expect(rule?.roles).toEqual(["ceo", "admin"]);
    expect(rule?.money).toBeUndefined();
    expect(canOpen("coach", "/stock/reports")).toBe(false);
    expect(canOpen("admin", "/stock/reports")).toBe(true);
  });
  test("while the data is the fixture the page says so (Sample data)", () => {
    expect(STOCK_REPORT_SOURCE).toBe("fixture");
    expect(readFileSync("src/components/partials/StockReport/StockReport.tsx", "utf8")).toContain("Sample data");
  });
});
