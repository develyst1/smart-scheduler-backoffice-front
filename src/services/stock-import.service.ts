// Stock git-style import — the data seam (BF half of TASK-904, screen TASK-908). WIRED to the live backoffice (BB 693627d): `STOCK_IMPORT_SOURCE.import` is "api"; the fixture branch stays behind it
// (the tests flip it). No component imports the fixture. CEO only (hide, never mask): any other role is refused here too, before any request.
//   preview → POST /v1/stock/import/preview   multipart `file` (.xlsx, ≤ 5 MB) → { batchId, rows[{model,name,kind,before,after,delta}], notImported[], flags[{model,row,message}], unchanged }   (stages server-side, writes nothing)
//   apply   → POST /v1/stock/import/apply     { batchId } ONLY → { batchId, movementsWritten, itemsAdded, fieldEdits, removedLeft, alreadyApplied? }
//   errors  → the app envelope { error:{code,message,details} }: 409 NEGATIVE_BALANCE {model,name,resultingBalance} · 409 STALE · 404 BATCH_NOT_FOUND · 400 on a bad sheet {errors:[{row,column,message}],total}
import { api, ApiClientError } from "@/lib/api/client";
import { STOCK_IMPORT_NEGATIVE_ROW, STOCK_IMPORT_NOT_IMPORTED, STOCK_IMPORT_ROWS } from "@/services/__fixtures__/stock-import";
import type { Role } from "@/types/app/roles";
import type { ImportDiffRow, ImportKind, ImportPreview, ImportResult, StockSnapshot } from "@/types/app/stock-import";

export const STOCK_IMPORT_SOURCE: Record<"import", "fixture" | "api"> = { import: "api" };

const ceoOnly = (role: Role | null) => {
  if (role !== "ceo") throw new ApiClientError("FORBIDDEN", "ไม่มีสิทธิ์นำเข้าสต๊อก", 403);
};

// ---- the live answer → the screen's shape ----------------------------------------------------------------------------------------------------------------------------------------

const KINDS: readonly ImportKind[] = ["new", "qty_change", "field_change", "removed"];
const isSide = (s: unknown): s is StockSnapshot => !!s && typeof s === "object" && Object.keys(s as object).length > 0;

/**
 * The real preview row → the screen's row. The back sends `{}` for a side that does not exist (and, for a `new` row, `{quantity: null}` as the "before"), only the fields that CHANGED, and a numeric
 * `delta` (0 when no stock moves). The screen reads `null` for "no such side": a `new` row has no before, a `removed` row has no after.
 */
export function normalizeRow(raw: Record<string, unknown>): ImportDiffRow {
  const kind = raw.kind as ImportKind;
  const before = kind === "new" ? null : isSide(raw.before) ? (raw.before as StockSnapshot) : null;
  const after = kind === "removed" ? null : isSide(raw.after) ? (raw.after as StockSnapshot) : null;
  return {
    model: String(raw.model ?? ""),
    name: String(raw.name ?? ""),
    kind: KINDS.includes(kind) ? kind : "field_change",
    before,
    after,
    delta: typeof raw.delta === "number" ? raw.delta : null,
  };
}

/** A flag is `{model, row, message}` on the wire; the screen shows one sentence each. A plain string passes through. */
export function flagText(f: unknown): string {
  if (typeof f === "string") return f;
  const o = (f ?? {}) as { model?: unknown; row?: unknown; message?: unknown };
  const where = [o.model ? String(o.model) : "", typeof o.row === "number" ? `sheet row ${o.row}` : ""].filter(Boolean).join(", ");
  return `${where ? `${where}: ` : ""}${String(o.message ?? "")}`.trim();
}

export function normalizePreview(raw: unknown): ImportPreview {
  const r = (raw ?? {}) as Record<string, unknown>;
  const flags = Array.isArray(r.flags) ? r.flags.map(flagText).filter(Boolean) : [];
  return {
    batchId: String(r.batchId ?? ""),
    rows: Array.isArray(r.rows) ? r.rows.map((x) => normalizeRow(x as Record<string, unknown>)) : [],
    notImported: Array.isArray(r.notImported) ? r.notImported.map(String) : [],
    ...(flags.length ? { flags } : {}),
    ...(typeof r.unchanged === "number" ? { unchanged: r.unchanged } : {}),
  };
}

// ---- the fixture branch ----------------------------------------------------------------------------------------------------------------------------------------------------------

const batchIdOf = (rows: ImportPreview["rows"]) => `batch-${rows.map((r) => `${r.model}:${r.kind}:${r.delta ?? 0}`).join("|").length}-${rows.length}`;
const applied = new Set<string>();

function fixturePreview(file: { name: string }): ImportPreview {
  if (!/\.xlsx$/i.test(file.name)) throw new ApiClientError("VALIDATION", "ไฟล์ต้องเป็น .xlsx", 400);
  const rows = structuredClone(STOCK_IMPORT_ROWS);
  if (/negative/i.test(file.name)) rows.push(structuredClone(STOCK_IMPORT_NEGATIVE_ROW));
  const flags = /flag/i.test(file.name) ? ["The sheet's Other (future branches) column has a non-zero balance; it is not imported."] : [];
  return { batchId: (/stale/i.test(file.name) ? "stale-" : "") + batchIdOf(rows), rows, notImported: [...STOCK_IMPORT_NOT_IMPORTED], ...(flags.length ? { flags } : {}) };
}

function fixtureApply(preview: ImportPreview): ImportResult {
  // fixture only: a batch whose id says "stale" stands for the real 409 STALE / 404 BATCH_NOT_FOUND
  if (/^stale/.test(preview.batchId)) throw new ApiClientError("STALE", "stock changed since the check", 409);
  const bad = preview.rows.find((r) => r.after && typeof r.after.quantity === "number" && r.after.quantity < 0);
  if (bad) {
    throw new ApiClientError("NEGATIVE_BALANCE", `ไม่สามารถนำเข้าได้: ${bad.model} (${bad.name}) จะมียอดคงเหลือติดลบ (${bad.after?.quantity})`, 409, { model: bad.model, name: bad.name, resultingBalance: bad.after?.quantity });
  }
  const already = applied.has(preview.batchId);
  applied.add(preview.batchId);
  const count = (k: string) => preview.rows.filter((r) => r.kind === k).length;
  return {
    batchId: preview.batchId,
    movementsWritten: already ? 0 : preview.rows.filter((r) => r.delta !== null && r.delta !== 0 && r.kind !== "removed").length,
    itemsAdded: already ? 0 : count("new"),
    fieldEdits: already ? 0 : count("field_change"),
    removedLeft: count("removed"),
    ...(already ? { alreadyApplied: true } : {}),
  };
}

// ---- the two calls ---------------------------------------------------------------------------------------------------------------------------------------------------------------

/** Upload the sheet, get the diff. NO write. A file that is not an .xlsx is a 400 (the server checks the bytes; the fixture the name), not a crash. */
export async function previewStockImport(file: { name: string }, role: Role | null): Promise<ImportPreview> {
  ceoOnly(role);
  if (STOCK_IMPORT_SOURCE.import === "api") {
    const body = new FormData();
    body.append("file", file as File, file.name);
    // the shared client defaults to JSON, which would turn a FormData into JSON: say multipart so axios sends the form (the browser adds the boundary)
    const { data } = await api.post<unknown>("/v1/stock/import/preview", body, { headers: { "Content-Type": "multipart/form-data" } });
    return normalizePreview(data);
  }
  return fixturePreview(file);
}

/** Confirm a previewed batch: the server holds the staged diff, so ONLY the batch id goes back. A negative balance is refused whole; a re-apply of the same batch writes nothing. */
export async function applyStockImport(preview: ImportPreview, role: Role | null): Promise<ImportResult> {
  ceoOnly(role);
  if (STOCK_IMPORT_SOURCE.import === "api") {
    const { data } = await api.post<ImportResult>("/v1/stock/import/apply", { batchId: preview.batchId });
    return data;
  }
  return fixtureApply(preview);
}
