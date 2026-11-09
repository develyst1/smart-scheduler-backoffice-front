import type { ImportDiffRow, ImportKind, StockSnapshot } from "@/types/app/stock-import";

// Pure rules for the Stock import screen: grouping, the signed quantity, and which fields a row changed. No React, so they are unit-tested.

/** The groups, in the order the screen shows them. */
export const KIND_ORDER: ImportKind[] = ["new", "qty_change", "field_change", "removed"];

export const KIND_LABEL: Record<ImportKind, string> = {
  new: "New items",
  qty_change: "Quantity changes",
  field_change: "Field changes",
  removed: "Removed from the sheet",
};

export interface DiffGroup {
  kind: ImportKind;
  label: string;
  rows: ImportDiffRow[];
}

/** Rows grouped by kind, in KIND_ORDER; an empty group is left out. Rows keep the sheet's order inside a group. */
export function groupByKind(rows: readonly ImportDiffRow[]): DiffGroup[] {
  return KIND_ORDER.map((kind) => ({ kind, label: KIND_LABEL[kind], rows: rows.filter((r) => r.kind === kind) })).filter((g) => g.rows.length > 0);
}

/** A signed whole quantity: +4, −1 (real minus sign), 0. */
export function signedQty(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

export interface FieldDelta {
  field: "name" | "priceSatang" | "category" | "commissionGroup";
  /** price is whole satang; commission group is shown as "name · amount" by the caller, so it is carried as text here */
  before: string | number | null;
  after: string | number | null;
}

const groupText = (g: StockSnapshot["commissionGroup"]): string | null => (g ? g : null);

/** The name / price / category / commission-group edits of one row (a `field_change`). A quantity move is the row's `delta`, never a field edit. */
export function fieldDeltas(before: StockSnapshot | null, after: StockSnapshot | null): FieldDelta[] {
  if (!before || !after) return [];
  const out: FieldDelta[] = [];
  if (before.name !== after.name) out.push({ field: "name", before: before.name ?? null, after: after.name ?? null });
  if (before.priceSatang !== after.priceSatang) out.push({ field: "priceSatang", before: before.priceSatang ?? null, after: after.priceSatang ?? null });
  if ((before.category ?? null) !== (after.category ?? null)) out.push({ field: "category", before: before.category ?? null, after: after.category ?? null });
  if (groupText(before.commissionGroup) !== groupText(after.commissionGroup)) {
    out.push({ field: "commissionGroup", before: groupText(before.commissionGroup), after: groupText(after.commissionGroup) });
  }
  return out;
}

/** 409 STALE (balances moved since the preview) and 404 BATCH_NOT_FOUND (the staged batch expired): both mean "check the changes again", not "the import failed". */
export function isStaleBatch(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "STALE" || code === "BATCH_NOT_FOUND";
}

export interface NegativeBalanceDetails {
  model: string;
  name: string;
  resultingBalance: number;
}

/** `error.details` of a 409 NEGATIVE_BALANCE (`{model, name, resultingBalance}`); null for any other error or a malformed details object. */
export function negativeBalanceDetails(error: unknown): NegativeBalanceDetails | null {
  const e = error as { code?: unknown; details?: unknown } | null;
  if (e?.code !== "NEGATIVE_BALANCE") return null;
  const d = e.details as Partial<NegativeBalanceDetails> | null | undefined;
  if (!d || typeof d.model !== "string" || typeof d.name !== "string" || typeof d.resultingBalance !== "number") return null;
  return { model: d.model, name: d.name, resultingBalance: d.resultingBalance };
}

/**
 * A 400 on the preview lists the bad cells in `error.details = { errors: [{row, column, message}], total }`. Returns up to `max` lines («row 7 · Name: Name ว่าง») and how many more there are.
 * Any other error, or a malformed details object, gives nothing.
 */
export function sheetProblems(error: unknown, max = 10): { lines: string[]; more: number } {
  const d = (error as { details?: unknown } | null)?.details as { errors?: unknown; total?: unknown } | null | undefined;
  if (!d || !Array.isArray(d.errors)) return { lines: [], more: 0 };
  const lines = d.errors
    .filter((e): e is { row: number; column: string; message: string } => !!e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string")
    .map((e) => `row ${e.row} · ${e.column}: ${e.message}`);
  const total = typeof d.total === "number" ? d.total : lines.length;
  return { lines: lines.slice(0, max), more: Math.max(0, total - Math.min(lines.length, max)) };
}

export interface DiffCounts {
  total: number;
  byKind: Record<ImportKind, number>;
  /** rows the apply will write something for: everything except `removed` (shown, never acted) */
  willChange: number;
}

export function countDiff(rows: readonly ImportDiffRow[]): DiffCounts {
  const byKind: Record<ImportKind, number> = { new: 0, qty_change: 0, field_change: 0, removed: 0 };
  for (const r of rows) byKind[r.kind] += 1;
  return { total: rows.length, byKind, willChange: rows.length - byKind.removed };
}
