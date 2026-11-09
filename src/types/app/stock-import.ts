// Stock git-style import (BF half of TASK-904). 🟡 The shape is Sober's diff contract as written in his hand-off:
//   preview → per Model code `{ model, kind, before, after, delta }`; apply → movements written, items added, removed rows left, a negative-balance refusal naming the item.
// Everything not in that line (the envelope `{ batchId, rows, notImported }`, the `before`/`after` keys, the apply body/result keys) is MY PROPOSAL — marked PENDING Sober Q<n>.
export type Satang = number;

export type ImportKind = "new" | "qty_change" | "field_change" | "removed";

/** The fields the import writes (TASK-908 CONTRACT Q1, matched to 904): name · price · balance · category (a tag) · commission group. */
export interface StockSnapshot {
  name?: string;
  priceSatang?: Satang;
  quantity?: number;
  category?: string | null;
  /** the commission GROUP NAME only (the real preview sends the name; the amount lives on the group); null = none */
  commissionGroup?: string | null;
}

export interface ImportDiffRow {
  /** the Model code (bo.item.externalRef) */
  model: string;
  /** a display name for the row (after.name, else before.name) — PENDING Sober Q1: whether the back sends it separately */
  name: string;
  kind: ImportKind;
  /** null for `new` */
  before: StockSnapshot | null;
  /** null for `removed` (shown, never acted) */
  after: StockSnapshot | null;
  /** signed quantity change; null when the row moves no stock */
  delta: number | null;
}

/** POST /v1/stock/import/preview — NO write. PENDING Sober Q1: the envelope. */
export interface ImportPreview {
  /** hash of the diff: what `apply` confirms (idempotent per batch) — PENDING Sober Q2 */
  batchId: string;
  rows: ImportDiffRow[];
  /** sheet columns the import does not write (e.g. "Other" = future branches, picture, note…) — PENDING Sober Q3 */
  notImported: string[];
  /** warnings to read before confirming, one sentence each (the real route sends `{model,row,message}`; the service words them). Absent or empty = none. */
  flags?: string[];
  /** rows of the sheet that match the stock exactly: counted, not listed */
  unchanged?: number;
}

/** POST /v1/stock/import/apply — PENDING Sober Q2 (body = the batch id) and Q4 (result keys). */
export interface ImportResult {
  batchId: string;
  movementsWritten: number;
  itemsAdded: number;
  fieldEdits: number;
  removedLeft: number;
  /** true when the batch had already been applied (a re-apply writes nothing) — PENDING Sober Q4 */
  alreadyApplied?: boolean;
}
