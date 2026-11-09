// Stock import — fixture of TASK-904's diff contract (final-ui has no import screen; Sober's hand-off is the source). ONLY `stock-import.service.ts` imports this file.
// 🟡 PENDING Sober: names/codes are invented (CONVENTIONS §2.8). The wiring TASK swaps the service body and deletes this file.
import type { ImportDiffRow, StockSnapshot } from "@/types/app/stock-import";

const baht = (n: number) => n * 100;
const snap = (name: string, price: number, quantity: number, extra: Partial<StockSnapshot> = {}): StockSnapshot => ({ name, priceSatang: baht(price), quantity, ...extra });

export const STOCK_IMPORT_ROWS: ImportDiffRow[] = [
  { model: "MIL-IN-001", name: "Miller inline skate — Seaworld", kind: "qty_change", before: snap("Miller inline skate — Seaworld", 3900, 6), after: snap("Miller inline skate — Seaworld", 3900, 10), delta: 4 },
  { model: "MIL-HEL-010", name: "Miller helmet — M", kind: "qty_change", before: snap("Miller helmet — M", 1290, 4), after: snap("Miller helmet — M", 1290, 3), delta: -1 },
  {
    model: "ANI-HEL-020",
    name: "Animal helmet — S",
    kind: "field_change",
    // like the real preview: a field_change carries only the fields that changed
    before: { priceSatang: baht(790), category: "Safety", commissionGroup: "Animal Helmet" },
    after: { priceSatang: baht(850), category: "Helmets", commissionGroup: "Animal Helmet Pro" },
    delta: null,
  },
  { model: "FB-WAT-070", name: "Water 600 ml", kind: "field_change", before: snap("Water 600 ml", 20, 8), after: snap("Water 600 ml (cold)", 25, 8), delta: null },
  { model: "BIK-NEW-060", name: "Balance bike — 12 inch", kind: "new", before: null, after: snap("Balance bike — 12 inch", 3500, 6), delta: 6 },
  { model: "OLD-HEL-099", name: "Old helmet (retired)", kind: "removed", before: snap("Old helmet (retired)", 500, 2), after: null, delta: null },
];

/** A row that would take a balance below zero: the fixture adds it when the chosen file's name contains "negative", so the refusal path can be seen without the real back end. */
export const STOCK_IMPORT_NEGATIVE_ROW: ImportDiffRow = {
  model: "OTH-SOC-081",
  name: "Sock",
  kind: "qty_change",
  before: snap("Sock", 120, 2),
  after: snap("Sock", 120, -3),
  delta: -5,
};

export const STOCK_IMPORT_NOT_IMPORTED = ["Other (future branches)", "Picture", "Note"];
