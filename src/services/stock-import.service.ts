// Stock git-style import — the data seam (BF half of TASK-904). Answers from a typed fixture until Bob's 904 lands; the wiring TASK swaps ONLY these bodies
// (`POST /v1/stock/import/preview` multipart, `POST /v1/stock/import/apply`). No component imports the fixture. CEO only (hide, never mask): any other role is refused here too.
import { ApiClientError } from "@/lib/api/client";
import { STOCK_IMPORT_NEGATIVE_ROW, STOCK_IMPORT_NOT_IMPORTED, STOCK_IMPORT_ROWS } from "@/services/__fixtures__/stock-import";
import type { Role } from "@/types/app/roles";
import type { ImportPreview, ImportResult } from "@/types/app/stock-import";

export const STOCK_IMPORT_SOURCE: "fixture" | "api" = "fixture";

const ceoOnly = (role: Role) => {
  if (role !== "ceo") throw new ApiClientError("FORBIDDEN", "ไม่มีสิทธิ์นำเข้าสต๊อก", 403);
};

const batchIdOf = (rows: ImportPreview["rows"]) => `batch-${rows.map((r) => `${r.model}:${r.kind}:${r.delta ?? 0}`).join("|").length}-${rows.length}`;
const applied = new Set<string>();

/** Upload the sheet, get the diff. NO write. A file that is not an .xlsx is a 400, not a crash. */
export async function previewStockImport(file: { name: string }, role: Role): Promise<ImportPreview> {
  ceoOnly(role);
  if (!/\.xlsx$/i.test(file.name)) throw new ApiClientError("VALIDATION", "ไฟล์ต้องเป็น .xlsx", 400);
  const rows = structuredClone(STOCK_IMPORT_ROWS);
  if (/negative/i.test(file.name)) rows.push(structuredClone(STOCK_IMPORT_NEGATIVE_ROW));
  const flags = /flag/i.test(file.name) ? ["The sheet's Other (future branches) column has a non-zero balance; it is not imported."] : [];
  return { batchId: (/stale/i.test(file.name) ? "stale-" : "") + batchIdOf(rows), rows, notImported: [...STOCK_IMPORT_NOT_IMPORTED], ...(flags.length ? { flags } : {}) };
}

/** Confirm a previewed batch. A batch that would make a balance negative is refused whole, naming the item. Re-applying a batch writes nothing. */
export async function applyStockImport(preview: ImportPreview, role: Role): Promise<ImportResult> {
  ceoOnly(role);
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
    movementsWritten: already ? 0 : preview.rows.filter((r) => r.delta !== null && r.kind !== "removed").length,
    itemsAdded: already ? 0 : count("new"),
    fieldEdits: already ? 0 : count("field_change"),
    removedLeft: count("removed"),
    ...(already ? { alreadyApplied: true } : {}),
  };
}
