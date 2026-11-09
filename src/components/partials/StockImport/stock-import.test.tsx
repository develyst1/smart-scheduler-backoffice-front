// Stock git-style import (BF half of TASK-904), on the fixture seam. Run: `bun test src/components/partials/StockImport`.
// Each test names the code whose removal makes it fail.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { AxiosError } from "axios";
import { api, ApiClientError } from "@/lib/api/client";
import { applyStockImport, previewStockImport } from "@/services/stock-import.service";
import { canOpen, menuFor } from "@/lib/roles/pages";
import { DiffBody, ResultBody } from "./StockImport";
import { countDiff, fieldDeltas, groupByKind, isStaleBatch, negativeBalanceDetails, signedQty } from "./import-logic";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const file = (name: string) => ({ name });

describe("the diff", () => {
  test("rows are grouped by kind in the fixed order, and every kind is counted", async () => {
    const p = await previewStockImport(file("stock.xlsx"), "ceo");
    expect(groupByKind(p.rows).map((g) => g.kind)).toEqual(["new", "qty_change", "field_change", "removed"]);
    const c = countDiff(p.rows);
    expect(c.byKind).toEqual({ new: 1, qty_change: 2, field_change: 2, removed: 1 });
    expect(c.willChange).toBe(5); // the removed row is not a change
  });

  test("the quantity delta is signed (+4, −1), and the screen shows it", async () => {
    expect(signedQty(4)).toBe("+4");
    expect(signedQty(-1)).toBe("−1");
    expect(signedQty(0)).toBe("0");
    const html = ui(<DiffBody preview={await previewStockImport(file("stock.xlsx"), "ceo")} />);
    expect(html).toContain("+4");
    expect(html).toContain("−1");
    expect(html).toContain("6 → 10");
  });

  test("a field change lists the name and price edits, never as a movement", async () => {
    const p = await previewStockImport(file("stock.xlsx"), "ceo");
    const row = p.rows.find((r) => r.model === "FB-WAT-070")!;
    expect(fieldDeltas(row.before, row.after).map((d) => d.field)).toEqual(["name", "priceSatang"]);
    const html = ui(<DiffBody preview={p} />);
    expect(html).toContain("Water 600 ml → Water 600 ml (cold)");
    expect(html).toContain("20.00 ฿ → 25.00 ฿");
  });

  test("category and commission-group edits are listed too (TASK-908 contract: 904 imports both)", async () => {
    const p = await previewStockImport(file("stock.xlsx"), "ceo");
    const row = p.rows.find((r) => r.model === "ANI-HEL-020")!;
    expect(fieldDeltas(row.before, row.after).map((d) => d.field)).toEqual(["priceSatang", "category", "commissionGroup"]);
    // an unchanged group is not a change; a removed group is
    expect(fieldDeltas({ commissionGroup: { name: "A", amountSatang: 1 } }, { commissionGroup: { name: "A", amountSatang: 1 } })).toEqual([]);
    expect(fieldDeltas({ commissionGroup: { name: "A", amountSatang: 1 } }, { commissionGroup: null }).map((d) => d.field)).toEqual(["commissionGroup"]);
    const html = ui(<DiffBody preview={p} />);
    expect(html).toContain("Category: Safety → Helmets");
    expect(html).toContain("Commission group: Animal Helmet (40.00 ฿) → Animal Helmet (50.00 ฿)");
  });

  test("the kind strings are exactly the contract's four", async () => {
    const p = await previewStockImport(file("stock.xlsx"), "ceo");
    expect([...new Set(p.rows.map((r) => r.kind))].sort()).toEqual(["field_change", "new", "qty_change", "removed"]);
  });

  test("a removed row is shown and marked as not acted; the section exists", async () => {
    const html = ui(<DiffBody preview={await previewStockImport(file("stock.xlsx"), "ceo")} />);
    expect(html).toContain('data-group="removed"');
    expect(html).toContain("OLD-HEL-099");
    expect(html).toContain("not deleted");
  });

  test("the sheet columns the import does not write are named", async () => {
    const html = ui(<DiffBody preview={await previewStockImport(file("stock.xlsx"), "ceo")} />);
    expect(html).toContain("data-not-imported");
    expect(html).toContain("Other (future branches)");
  });

  test("an empty diff says so (no groups)", () => {
    const html = ui(<DiffBody preview={{ batchId: "b", rows: [], notImported: [] }} />);
    expect(html).toContain("data-diff-empty");
    expect(html).not.toContain("data-group=");
  });
});

describe("preview and apply", () => {
  test("a file that is not an .xlsx is a 400, not a crash", async () => {
    const err = await previewStockImport(file("stock.csv"), "ceo").catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.status).toBe(400);
  });

  test("only the CEO may preview or apply (an admin and a coach are refused)", async () => {
    for (const role of ["admin", "coach"] as const) {
      expect(await previewStockImport(file("stock.xlsx"), role).catch((e) => e.status)).toBe(403);
    }
    const p = await previewStockImport(file("stock.xlsx"), "ceo");
    expect(await applyStockImport(p, "admin").catch((e) => e.status)).toBe(403);
  });

  test("apply reports movements, items added, field edits and removed rows left", async () => {
    const p = await previewStockImport(file("counts.xlsx"), "ceo");
    const r = await applyStockImport(p, "ceo");
    expect(r).toMatchObject({ movementsWritten: 3, itemsAdded: 1, fieldEdits: 2, removedLeft: 1 });
    const html = ui(<ResultBody result={r} />);
    expect(html).toContain("Movements written: 3");
    expect(html).toContain("Removed rows left in stock: 1");
  });

  test("a re-apply of the same batch writes nothing and says so", async () => {
    const p = await previewStockImport(file("again.xlsx"), "ceo");
    await applyStockImport(p, "ceo");
    const again = await applyStockImport(p, "ceo");
    expect(again.alreadyApplied).toBe(true);
    expect(again.movementsWritten).toBe(0);
    expect(ui(<ResultBody result={again} />)).toContain("nothing written again");
  });

  test("the preview's flags[] are shown before confirming; none → no flag box", async () => {
    const flagged = await previewStockImport(file("flag.xlsx"), "ceo");
    expect(ui(<DiffBody preview={flagged} />)).toContain("data-flags");
    expect(ui(<DiffBody preview={flagged} />)).toContain("non-zero balance");
    const plain = await previewStockImport(file("stock.xlsx"), "ceo");
    expect(ui(<DiffBody preview={plain} />)).not.toContain("data-flags");
  });

  test("409 STALE and 404 BATCH_NOT_FOUND mean 'check again'; NEGATIVE_BALANCE does not", async () => {
    expect(isStaleBatch(new ApiClientError("STALE", "x", 409))).toBe(true);
    expect(isStaleBatch(new ApiClientError("BATCH_NOT_FOUND", "x", 404))).toBe(true);
    expect(isStaleBatch(new ApiClientError("NEGATIVE_BALANCE", "x", 409))).toBe(false);
    const p = await previewStockImport(file("stale.xlsx"), "ceo");
    const err = await applyStockImport(p, "ceo").catch((e) => e);
    expect(isStaleBatch(err)).toBe(true);
  });

  test("the client carries the envelope's error.details, and NEGATIVE_BALANCE reads {model, name, resultingBalance} from it", async () => {
    const real = api.defaults.adapter;
    api.defaults.adapter = async (config) => {
      const response = { status: 409, statusText: "", headers: {}, config, data: { error: { code: "NEGATIVE_BALANCE", message: "stock would go below zero", details: { model: "OTH-SOC-081", name: "Sock", resultingBalance: -3 } } } };
      throw new AxiosError("HTTP 409", "ERR_BAD_REQUEST", config, null, response);
    };
    try {
      const err = await api.post("/v1/stock/import/apply", { batchId: "b" }).catch((e) => e);
      expect(err).toBeInstanceOf(ApiClientError);
      expect(err.code).toBe("NEGATIVE_BALANCE");
      expect(negativeBalanceDetails(err)).toEqual({ model: "OTH-SOC-081", name: "Sock", resultingBalance: -3 });
    } finally {
      api.defaults.adapter = real;
    }
    // any other code, or a malformed details object, gives nothing
    expect(negativeBalanceDetails(new ApiClientError("STALE", "x", 409, { model: "m", name: "n", resultingBalance: 1 }))).toBeNull();
    expect(negativeBalanceDetails(new ApiClientError("NEGATIVE_BALANCE", "x", 409, { model: "m" }))).toBeNull();
  });

  test("the fixture's refusal carries the same details", async () => {
    const err = await applyStockImport(await previewStockImport(file("negative.xlsx"), "ceo"), "ceo").catch((e) => e);
    expect(negativeBalanceDetails(err)).toEqual({ model: "OTH-SOC-081", name: "Sock", resultingBalance: -3 });
  });

  test("a batch that would make a balance negative is refused whole, naming the item", async () => {
    const p = await previewStockImport(file("negative.xlsx"), "ceo");
    const err = await applyStockImport(p, "ceo").catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.code).toBe("NEGATIVE_BALANCE");
    expect(err.message).toContain("OTH-SOC-081");
  });
});

describe("who sees the page", () => {
  test("the edge cookie guard covers every /stock route (proxy.ts matcher)", () => {
    const src = readFileSync("src/proxy.ts", "utf8");
    expect(src).toContain('"/stock/:path*"');
  });

  test("CEO only: listed in the menu for the CEO, closed to admin and coach", () => {
    const stock = (r: "ceo" | "admin" | "coach") => (menuFor(r).find((g) => g.group === "STOCK")?.items ?? []).map((i) => i.href);
    expect(stock("ceo")).toContain("/stock/import");
    expect(stock("admin")).not.toContain("/stock/import");
    expect(canOpen("admin", "/stock/import")).toBe(false);
    expect(canOpen("coach", "/stock/import")).toBe(false);
    expect(canOpen("ceo", "/stock/import")).toBe(true);
  });
});
