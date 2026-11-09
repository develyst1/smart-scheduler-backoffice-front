// The Stock import WIRED to the live backoffice (BB 693627d): the request each call sends and how the real answer becomes the screen's rows. No network: axios gets a recording adapter.
// Run: `bun test src/components/partials/StockImport`. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api, ApiClientError } from "@/lib/api/client";
import { STOCK_IMPORT_SOURCE, applyStockImport, flagText, normalizePreview, normalizeRow, previewStockImport } from "@/services/stock-import.service";
import { DiffBody } from "./StockImport";
import { isStaleBatch, negativeBalanceDetails, sheetProblems } from "./import-logic";

const realAdapter = api.defaults.adapter;
let left: "fixture" | "api" | null = null;
afterEach(() => {
  api.defaults.adapter = realAdapter;
  if (left) STOCK_IMPORT_SOURCE.import = left;
  left = null;
});

/** The live branch on for the test, whatever another file left behind; every request is recorded. */
function live(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  left = STOCK_IMPORT_SOURCE.import;
  STOCK_IMPORT_SOURCE.import = "api";
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

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const xlsx = () => new File([new Uint8Array([0x50, 0x4b, 3, 4])], "stock.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

/** Shaped exactly as `previewRows` of the back end builds it (only the changed fields; `{}` for a missing side; a numeric delta; flags as objects). */
const REAL = {
  batchId: "0123456789abcdef0123456789abcdef",
  rows: [
    { model: "BIK-NEW-060", name: "Balance bike", kind: "new", before: { quantity: null }, after: { name: "Balance bike", priceSatang: 350000, category: "Bike", commissionGroup: "Royal baby", quantity: 6 }, delta: 6 },
    { model: "MIL-IN-001", name: "Miller skate", kind: "qty_change", before: { quantity: 6 }, after: { quantity: 10 }, delta: 4 },
    { model: "ANI-HEL-020", name: "Animal helmet", kind: "field_change", before: { priceSatang: 79000, commissionGroup: "Animal Helmet" }, after: { priceSatang: 85000, commissionGroup: null }, delta: 0 },
    { model: "OLD-HEL-099", name: "Old helmet", kind: "removed", before: { name: "Old helmet", quantity: 2 }, after: {}, delta: 0 },
  ],
  notImported: ["Other", "Picture"],
  flags: [{ model: "BIK-NEW-060", row: 12, message: "No revenue category matches «Bike»" }],
  unchanged: 150,
};

describe("shipped switch", () => {
  test("the import ships wired (api) — read from the source, not from the live object", () => {
    expect(readFileSync("src/services/stock-import.service.ts", "utf8")).toContain('{ import: "api" }');
  });
});

describe("preview → POST /v1/stock/import/preview", () => {
  test("sends the file as a multipart form field «file» (not JSON) and returns the screen's shape", async () => {
    const seen = live(() => ({ status: 200, data: REAL }));
    const p = await previewStockImport(xlsx(), "ceo");
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("/v1/stock/import/preview");
    expect(seen[0].method).toBe("post");
    expect(seen[0].data).toBeInstanceOf(FormData);
    expect((seen[0].data as FormData).get("file")).toBeInstanceOf(File);
    expect(((seen[0].data as FormData).get("file") as File).name).toBe("stock.xlsx");
    expect(String(seen[0].headers.get("Content-Type"))).toContain("multipart/form-data");
    expect(p.batchId).toBe(REAL.batchId);
    expect(p.rows).toHaveLength(4);
  });

  test("a missing side `{}` becomes null, a `new` row has no before, a `removed` row no after; the kinds and deltas pass through", () => {
    const rows = normalizePreview(REAL).rows;
    const by = (m: string) => rows.find((r) => r.model === m)!;
    expect(by("BIK-NEW-060").before).toBeNull();
    expect(by("BIK-NEW-060").after?.quantity).toBe(6);
    expect(by("OLD-HEL-099").after).toBeNull();
    expect(by("OLD-HEL-099").before?.quantity).toBe(2);
    expect(by("MIL-IN-001")).toMatchObject({ kind: "qty_change", delta: 4 });
    expect(by("ANI-HEL-020")).toMatchObject({ kind: "field_change", delta: 0 });
  });

  test("a removed row never keeps an `after`, an empty side is null, and a note-only edit (empty before/after) is still shown as an edit", () => {
    expect(normalizeRow({ model: "X", name: "x", kind: "removed", before: { quantity: 1 }, after: { quantity: 5 }, delta: 0 }).after).toBeNull();
    const noteOnly = normalizeRow({ model: "N", name: "Note only", kind: "field_change", before: {}, after: {}, delta: 0 });
    expect(noteOnly.before).toBeNull();
    expect(noteOnly.after).toBeNull();
    const html = ui(<DiffBody preview={{ batchId: "b", rows: [noteOnly], notImported: [] }} />);
    expect(html).toContain("data-other-edit");
    expect(html).toContain("Other details (e.g. the note) updated");
  });

  test("a quantity change that also edits a field shows both the quantity and the edit", () => {
    const row = normalizeRow({ model: "Q", name: "Both", kind: "qty_change", before: { quantity: 2, priceSatang: 10000 }, after: { quantity: 5, priceSatang: 12000 }, delta: 3 });
    const html = ui(<DiffBody preview={{ batchId: "b", rows: [row], notImported: [] }} />);
    expect(html).toContain("2 → 5");
    expect(html).toContain("Price: 100.00 ฿ → 120.00 ฿");
  });

  test("flags {model,row,message} become one sentence each; `unchanged` and `notImported` are kept", () => {
    const p = normalizePreview(REAL);
    expect(p.flags).toEqual(["BIK-NEW-060, sheet row 12: No revenue category matches «Bike»"]);
    expect(p.unchanged).toBe(150);
    expect(p.notImported).toEqual(["Other", "Picture"]);
    expect(flagText("plain")).toBe("plain");
    expect(normalizePreview({ ...REAL, flags: [] }).flags).toBeUndefined();
  });

  test("the sparse real rows render: a commission group dropped, a price edit, a quantity change, the unchanged count and the flag", () => {
    const html = ui(<DiffBody preview={normalizePreview(REAL)} />);
    expect(html).toContain("Commission group: Animal Helmet → none");
    expect(html).toContain("Price: 790.00 ฿ → 850.00 ฿");
    expect(html).toContain("6 → 10");
    expect(html).toContain("150 rows of the sheet already match the stock");
    expect(html).toContain("No revenue category matches");
    expect(html).toContain("not deleted");
  });

  test("a bad sheet is a 400 whose details list the cells; they are shown as lines (first 10, then «and N more»)", async () => {
    const errors = Array.from({ length: 12 }, (_, i) => ({ row: i + 2, column: "Name", message: "Name ว่าง" }));
    live(() => ({ status: 400, data: { error: { code: "VALIDATION", message: "ไฟล์มี 12 จุดที่ไม่ถูกต้อง", details: { errors, total: 12 } } } }));
    const err = await previewStockImport(xlsx(), "ceo").catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.message).toBe("ไฟล์มี 12 จุดที่ไม่ถูกต้อง");
    const s = sheetProblems(err);
    expect(s.lines).toHaveLength(10);
    expect(s.lines[0]).toBe("row 2 · Name: Name ว่าง");
    expect(s.more).toBe(2);
    expect(sheetProblems(new ApiClientError("X", "m", 400, { errors: "nope" }))).toEqual({ lines: [], more: 0 });
    expect(sheetProblems(new Error("plain"))).toEqual({ lines: [], more: 0 });
  });
});

describe("apply → POST /v1/stock/import/apply", () => {
  test("sends ONLY the batch id (no diff, no file) and returns the server's counts", async () => {
    const seen = live(() => ({ status: 200, data: { batchId: REAL.batchId, movementsWritten: 3, itemsAdded: 1, fieldEdits: 2, removedLeft: 1 } }));
    const r = await applyStockImport(normalizePreview(REAL), "ceo");
    expect(seen[0].url).toBe("/v1/stock/import/apply");
    expect(JSON.parse(String(seen[0].data))).toEqual({ batchId: REAL.batchId });
    expect(r).toMatchObject({ movementsWritten: 3, itemsAdded: 1, fieldEdits: 2, removedLeft: 1 });
  });

  test("409 NEGATIVE_BALANCE carries error.details {model,name,resultingBalance}; STALE and BATCH_NOT_FOUND mean 'check again'", async () => {
    const answer = (status: number, code: string, details: unknown) => live(() => ({ status, data: { error: { code, message: `m-${code}`, details } } }));
    answer(409, "NEGATIVE_BALANCE", { model: "OTH-SOC-081", name: "Sock", resultingBalance: -3 });
    const neg = await applyStockImport(normalizePreview(REAL), "ceo").catch((e) => e);
    expect(neg.message).toBe("m-NEGATIVE_BALANCE");
    expect(negativeBalanceDetails(neg)).toEqual({ model: "OTH-SOC-081", name: "Sock", resultingBalance: -3 });
    expect(isStaleBatch(neg)).toBe(false);
    answer(409, "STALE", {});
    expect(isStaleBatch(await applyStockImport(normalizePreview(REAL), "ceo").catch((e) => e))).toBe(true);
    answer(404, "BATCH_NOT_FOUND", {});
    expect(isStaleBatch(await applyStockImport(normalizePreview(REAL), "ceo").catch((e) => e))).toBe(true);
  });

  test("a batch already applied answers alreadyApplied and the screen's result says nothing was written again", async () => {
    live(() => ({ status: 200, data: { batchId: REAL.batchId, movementsWritten: 0, itemsAdded: 0, fieldEdits: 0, removedLeft: 1, alreadyApplied: true } }));
    expect((await applyStockImport(normalizePreview(REAL), "ceo")).alreadyApplied).toBe(true);
  });
});

describe("who may call it", () => {
  test("only the CEO: an admin, a coach and a signed-out caller are refused 403 before any request", async () => {
    const seen = live(() => ({ status: 200, data: REAL }));
    for (const role of ["admin", "coach", null] as const) {
      expect((await previewStockImport(xlsx(), role).catch((e) => e.status)) as number).toBe(403);
      expect((await applyStockImport(normalizePreview(REAL), role).catch((e) => e.status)) as number).toBe(403);
    }
    expect(seen).toHaveLength(0);
  });
});
