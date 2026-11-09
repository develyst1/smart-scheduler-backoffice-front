// TASK-905 / TASK-907 — the data seam of the Stock block (Stock Out picker, Product page). The READ's API branch is TASK-904's `GET /v1/stock/products`
// (ceo+admin, optional `?q=`, Sober's shape); it stays OFF until 904 is deployed: flip `STOCK_SOURCE.products` to "api" (one word).
// The WRITES (TASK-907: create / edit a product) have no route defined yet (Sober: do not invent the write shape), so they live on the fixture only: `STOCK_SOURCE.writes`.
// No component imports the fixture.
import { api, ApiClientError } from "@/lib/api/client";
import { STOCK_PRODUCTS_FIXTURE } from "@/services/__fixtures__/stock";
import type { Role } from "@/types/app/roles";
import type { NegativeBalanceBody, Seller, StockInRequest, StockInResult, StockOutRequest, StockOutResult, RevenueCategory, StockProduct, StockProductInput, StockProductPatch } from "@/types/app/stock";

/** Flipped per screen, never globally (the back office is on sid since BB 693627d). `products` is wired (TASK-904 read); the writes are wired one screen at a time (TASK-907 / 910 / 912 / 913). */
export const STOCK_SOURCE: Record<"products" | "productWrites" | "out" | "stockIn" | "lowStock" | "sellers", "fixture" | "api"> = {
  products: "api",
  productWrites: "api",
  out: "api",
  stockIn: "api",
  lowStock: "api",
  sellers: "api",
};

// The fixture is a session-long in-memory store, so an add / edit on the Product page round-trips (the list reads it back).
let store: StockProduct[] | null = null;
const fixtureRows = (): StockProduct[] => (store ??= structuredClone(STOCK_PRODUCTS_FIXTURE));
/** Put the fixture back as shipped (tests; the wiring TASK deletes the store with the fixture). */
export const resetStockFixture = (): void => {
  store = null;
  sales.clear();
  receipts.clear();
  thresholds = null;
};

const byName = (a: StockProduct, b: StockProduct) => a.name.localeCompare(b.name);

/**
 * The products, by name; CEO and Admin only (a Coach gets nothing — hide, never mask). Sold-out products stay in the list (the picker disables them).
 * By default ACTIVE ones only (what a sale may pick); the Product page asks for `includeInactive`.
 * `q` is the optional server search of the real route; the pages filter on the client as you type, so they do not send one.
 */
export async function listStockProducts(role: Role, q?: string, opts: { includeInactive?: boolean } = {}): Promise<StockProduct[]> {
  if (role === "coach") return [];
  const keep = (p: StockProduct) => opts.includeInactive || p.active;
  if (STOCK_SOURCE.products === "api") {
    const { data } = await api.get<StockProduct[]>("/v1/stock/products", { params: q ? { q } : undefined });
    // the real route answers `category: null` for a product with no category tag; the screens read a string
    return (Array.isArray(data) ? data : []).map((p) => ({ ...p, category: p.category ?? "" })).filter(keep).sort(byName);
  }
  return structuredClone(fixtureRows().filter(keep).sort(byName));
}

/** Why a write was refused (fixture rules: the Model code is unique, case-insensitively). The real route's sentences replace these when it exists. */
export class StockWriteError extends Error {
  constructor(
    public code: "CODE_EXISTS" | "NOT_FOUND" | "FORBIDDEN" | "INVALID" | "METHOD_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "StockWriteError";
  }
  /** the app's standard error ENVELOPE, as the real route will answer */
  get body(): { error: { code: string; message: string; details: Record<string, never> } } {
    return { error: { code: this.code, message: this.message, details: {} } };
  }
}

/** The real routes' refusals (the app envelope) in the screens' own English sentences — the BB's messages are Thai, the back office is English-only. */
const WRITE_ERRORS: Record<string, [StockWriteError["code"], string | null]> = {
  DUPLICATE_CODE: ["CODE_EXISTS", "Model code already exists"],
  UNKNOWN_ITEM: ["NOT_FOUND", "Product not found"],
  UNKNOWN_REVENUE_CATEGORY: ["INVALID", "Revenue category not found"],
  ITEM_INACTIVE: ["INVALID", "This product is inactive"],
  NO_REVENUE_CATEGORY: ["INVALID", "This product has no revenue category — set it on the Product page first"],
  METHOD_REQUIRED: ["METHOD_REQUIRED", "Payment method is required"],
  FORBIDDEN: ["FORBIDDEN", "Not allowed"],
  VALIDATION: ["INVALID", null], // null ⇒ the server's own sentence
};
/** Re-throw a real route's refusal as a `StockWriteError` (anything else — a network failure, a 5xx — passes through untouched). */
export function asStockWriteError(e: unknown): never {
  if (e instanceof ApiClientError) {
    const hit = WRITE_ERRORS[e.code];
    if (hit) throw new StockWriteError(hit[0], hit[1] ?? e.message);
    if (e.status === 403) throw new StockWriteError("FORBIDDEN", "Not allowed");
  }
  throw e;
}

/** The product the real create / edit routes answer (`ProductDTO`: price and balance may be null) as the screens read it. */
const fromWire = (p: Omit<StockProduct, "category" | "priceSatang" | "quantity"> & { category: string | null; priceSatang: number | null; quantity: number | null }): StockProduct => ({
  ...p,
  category: p.category ?? "",
  priceSatang: p.priceSatang ?? 0,
  quantity: p.quantity ?? 0,
});

/** The product form's revenue categories: `GET /v1/stock/revenue-categories` → `{ categories: [{ id, type, name }] }` (CEO; an Admin never writes a product, so gets none). */
export async function listRevenueCategories(role: Role): Promise<RevenueCategory[]> {
  if (role !== "ceo") return [];
  if (STOCK_SOURCE.productWrites === "api") {
    const { data } = await api.get<{ categories: RevenueCategory[] }>("/v1/stock/revenue-categories");
    return Array.isArray(data?.categories) ? data.categories : [];
  }
  return [
    { id: "rc-sales", type: "SALES", name: "Equipment sales" },
    { id: "rc-fnb", type: "FNB", name: "Food & beverage" },
    { id: "rc-rent", type: "RENT", name: "Rental" },
  ];
}

/**
 * Add a product (TASK-907): `POST /v1/stock/products` — the CEO's alone on the real route. The balance starts at `openingQuantity` (0 when none), as ONE opening movement.
 * `revenueCategoryId` is required (the route answers 400 without it). Refusals come back as `StockWriteError` (DUPLICATE_CODE ⇒ CODE_EXISTS …).
 */
export async function createStockProduct(role: Role, input: StockProductInput): Promise<StockProduct> {
  if (role !== "ceo") throw new StockWriteError("FORBIDDEN", "Not allowed");
  if (STOCK_SOURCE.productWrites === "api") {
    const body = {
      code: input.code.trim(),
      name: input.name.trim(),
      category: input.category.trim() || null,
      priceSatang: input.priceSatang,
      commissionGroup: input.commissionGroup,
      active: input.active,
      openingQuantity: input.openingQuantity ?? 0,
      revenueCategoryId: input.revenueCategoryId,
    };
    try {
      const { data } = await api.post<Parameters<typeof fromWire>[0]>("/v1/stock/products", body);
      return fromWire(data);
    } catch (e) {
      return asStockWriteError(e);
    }
  }
  const rows = fixtureRows();
  if (rows.some((p) => p.code.toLowerCase() === input.code.trim().toLowerCase())) throw new StockWriteError("CODE_EXISTS", "Model code already exists");
  const created: StockProduct = {
    id: `p${rows.length + 1}-${Date.now()}`,
    code: input.code.trim(),
    name: input.name.trim(),
    category: input.category.trim(),
    priceSatang: input.priceSatang,
    quantity: input.openingQuantity ?? 0,
    commissionGroup: input.commissionGroup === null ? null : { name: input.commissionGroup, amountSatang: null },
    active: input.active,
  };
  rows.push(created);
  return structuredClone(created);
}

/** Edit a product (TASK-907): `PATCH /v1/stock/products/:id` (CEO) — everything but its Model code and its balance; only the fields given are sent. */
export async function updateStockProduct(role: Role, id: string, patch: StockProductPatch): Promise<StockProduct> {
  if (role !== "ceo") throw new StockWriteError("FORBIDDEN", "Not allowed");
  if (STOCK_SOURCE.productWrites === "api") {
    const body = {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.category !== undefined ? { category: patch.category.trim() || null } : {}),
      ...(patch.priceSatang !== undefined ? { priceSatang: patch.priceSatang } : {}),
      ...(patch.commissionGroup !== undefined ? { commissionGroup: patch.commissionGroup } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.revenueCategoryId !== undefined ? { revenueCategoryId: patch.revenueCategoryId } : {}),
    };
    try {
      const { data } = await api.patch<Parameters<typeof fromWire>[0]>(`/v1/stock/products/${encodeURIComponent(id)}`, body);
      return fromWire(data);
    } catch (e) {
      return asStockWriteError(e);
    }
  }
  const row = fixtureRows().find((p) => p.id === id);
  if (!row) throw new StockWriteError("NOT_FOUND", "Product not found");
  Object.assign(row, {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.category !== undefined ? { category: patch.category.trim() } : {}),
    ...(patch.priceSatang !== undefined ? { priceSatang: patch.priceSatang } : {}),
    ...(patch.commissionGroup !== undefined ? { commissionGroup: patch.commissionGroup === null ? null : { name: patch.commissionGroup, amountSatang: null } } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
  });
  return structuredClone(row);
}

// ───────────────────────── TASK-910: Stock OUT (the sell write) ─────────────────────────
// Wired to `POST /v1/stock/out` (`STOCK_SOURCE.out`); `ApiClientError.details` carries the 409's `{ model, name, resultingBalance }`.
const sales = new Map<string, StockOutResult>();

/** The refusal of a sale whose line would drive a balance below 0: the WHOLE sale is refused, nothing is written. */
export class NegativeBalanceError extends Error {
  readonly code = "NEGATIVE_BALANCE" as const;
  constructor(
    public model: string,
    public productName: string,
    public resultingBalance: number,
  ) {
    super(`NEGATIVE_BALANCE: ${model} (${productName}) would be ${resultingBalance}`);
    this.name = "NegativeBalanceError";
  }
  /** the 409 body of 909 in the standard envelope (`name` of the Error is the class name, so the product's name rides as `productName`) */
  get body(): NegativeBalanceBody {
    return { error: { code: "NEGATIVE_BALANCE", message: this.message, details: { model: this.model, name: this.productName, resultingBalance: this.resultingBalance } } };
  }
}

/**
 * Sell a cart: `POST /v1/stock/out` (TASK-909; CEO and Admin). Atomic on the server: every line is checked against the balance FIRST; one that would go below 0 refuses the whole sale
 * (409 NEGATIVE_BALANCE, `error.details = { model, name, resultingBalance }`, nothing written). Idempotent on `idempotencyKey`: the same key again writes nothing and answers the first result with `alreadyApplied: true`.
 * The answer carries NO totals (R0). `method` is required (400 METHOD_REQUIRED without it). A fixture twin runs when `STOCK_SOURCE.out = "fixture"`.
 */
export async function sellStockOut(role: Role, req: StockOutRequest): Promise<StockOutResult> {
  if (role === "coach") throw new StockWriteError("FORBIDDEN", "Not allowed");
  if (STOCK_SOURCE.out === "api") {
    try {
      const { data } = await api.post<StockOutResult>("/v1/stock/out", req);
      return data;
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "NEGATIVE_BALANCE") {
        const d = (e.details ?? {}) as { model?: unknown; name?: unknown; resultingBalance?: unknown };
        throw new NegativeBalanceError(String(d.model ?? ""), String(d.name ?? ""), Number(d.resultingBalance ?? 0));
      }
      return asStockWriteError(e);
    }
  }
  // 909 answers 400 METHOD_REQUIRED without a payment method (the revenue line's method is NOT NULL)
  if (!(["TRANSFER", "CASH", "CARD"] as const).includes(req.method)) throw new StockWriteError("METHOD_REQUIRED", "Payment method is required");
  const first = sales.get(req.idempotencyKey);
  if (first) return { ...first, alreadyApplied: true };
  const rows = fixtureRows();
  const need = new Map<string, number>();
  for (const l of req.lines) need.set(l.itemId, (need.get(l.itemId) ?? 0) + l.qty);
  for (const [itemId, qty] of need) {
    const p = rows.find((r) => r.id === itemId);
    if (!p) throw new StockWriteError("NOT_FOUND", "Product not found");
    if (p.quantity - qty < 0) throw new NegativeBalanceError(p.code, p.name, p.quantity - qty);
  }
  for (const [itemId, qty] of need) (rows.find((r) => r.id === itemId) as StockProduct).quantity -= qty;
  const result: StockOutResult = { saleId: `sale-${sales.size + 1}-${req.idempotencyKey.slice(0, 8)}`, movementsWritten: req.lines.length, soldAt: req.soldAt ?? new Date().toISOString().slice(0, 10) };
  sales.set(req.idempotencyKey, result);
  return { ...result };
}

/**
 * Who can be picked as a seller (Sober, TASK-910 Q1): the EXISTING `GET /v1/salary/entries/people` (TASK-886) — admin-safe: the ACTIVE people with a name, no pay, "No Teacher" already left out
 * (and re-checked here by `isSystem`). The seller's id is the teacher id (`sellerRefs`). A Coach gets nobody. `STOCK_SOURCE.sellers = "fixture"` falls back to invented names.
 */
export async function listSellers(role: Role): Promise<Seller[]> {
  if (role === "coach") return [];
  if (STOCK_SOURCE.sellers === "api") {
    const { data } = await api.get<Array<{ teacherId: string; name: string; isSystem?: boolean }>>("/v1/salary/entries/people");
    return (Array.isArray(data) ? data : []).filter((p) => !p.isSystem).map((p) => ({ id: p.teacherId, name: p.name })).sort((a, b) => a.name.localeCompare(b.name));
  }
  return [
    { id: "seller-ton", name: "Ton" },
    { id: "seller-ploy", name: "Ploy" },
    { id: "seller-nam", name: "Nam" },
    { id: "seller-may", name: "May" },
  ];
}

// ───────────────────────── TASK-912: Stock IN (the receive write) ─────────────────────────
// Wired to `POST /v1/stock/in` (TASK-911; `STOCK_SOURCE.stockIn`) with exactly this request / result.
const receipts = new Map<string, StockInResult>();

/**
 * FIXTURE ONLY: receive stock — a STOCK_IN raises each product's balance; it never lowers one, so there is no negative case. CEO and Admin (receiving is not pay / revenue).
 * No cost, no price: the product's sale price is untouched. Idempotent on `idempotencyKey`: the same key again adds nothing and answers the first result with `alreadyApplied: true`.
 */
export async function receiveStock(role: Role, req: StockInRequest): Promise<StockInResult> {
  if (role === "coach") throw new StockWriteError("FORBIDDEN", "Not allowed");
  if (STOCK_SOURCE.stockIn === "api") {
    // the same screen rule as the fixture: nothing is sent for an empty cart or a quantity that is not a whole number above 0
    if (req.lines.length === 0 || req.lines.some((l) => !Number.isInteger(l.qty) || l.qty <= 0)) throw new StockWriteError("INVALID", "Quantity must be a whole number above 0");
    try {
      const { data } = await api.post<StockInResult>("/v1/stock/in", req);
      return data;
    } catch (e) {
      return asStockWriteError(e);
    }
  }
  const first = receipts.get(req.idempotencyKey);
  if (first) return { ...first, alreadyApplied: true };
  if (req.lines.length === 0 || req.lines.some((l) => !Number.isInteger(l.qty) || l.qty <= 0)) throw new StockWriteError("INVALID", "Quantity must be a whole number above 0");
  const rows = fixtureRows();
  const targets = req.lines.map((l) => ({ row: rows.find((r) => r.id === l.itemId), qty: l.qty }));
  if (targets.some((t) => !t.row)) throw new StockWriteError("NOT_FOUND", "Product not found");
  for (const t of targets) (t.row as StockProduct).quantity += t.qty;
  const result: StockInResult = { receiptId: `receipt-${receipts.size + 1}-${req.idempotencyKey.slice(0, 8)}`, movementsWritten: req.lines.length, receivedOn: req.receivedOn };
  receipts.set(req.idempotencyKey, result);
  return { ...result };
}

// ───────────────────────── TASK-913: Low Stock thresholds ─────────────────────────
// Wired to `/v1/stock/low-stock*` (TASK-919; `STOCK_SOURCE.lowStock`); a tiny in-memory twin runs when the switch is "fixture". The Monday delivery is NOT here (a BE job tied to Notifications).
import { DEFAULT_THRESHOLDS, lowProducts } from "@/components/partials/Stock/low-stock-logic";
import type { LowStockRow, LowStockThresholds } from "@/types/app/stock";

let thresholds: LowStockThresholds | null = null;
const thresholdRows = (): LowStockThresholds => (thresholds ??= { ...DEFAULT_THRESHOLDS });

/**
 * The low-stock list: `GET /v1/stock/low-stock` → `{ items }` (CEO and Admin; no money). The server applies the rule (active products, the exact category's level, ≤ the level).
 * The fixture twin computes the same rule from the fixture products and thresholds.
 */
export async function listLowStock(role: Role): Promise<LowStockRow[]> {
  if (role === "coach") return [];
  if (STOCK_SOURCE.lowStock === "api") {
    const { data } = await api.get<{ items: LowStockRow[] }>("/v1/stock/low-stock");
    return Array.isArray(data?.items) ? data.items : [];
  }
  return lowProducts(fixtureRows(), thresholdRows()).map((l) => ({ id: l.product.id, code: l.product.code, name: l.product.name, category: l.product.category, quantity: l.product.quantity, threshold: l.threshold, under: l.under }));
}

/** The alert level per type (R3.7; the server's defaults until someone edits them): `GET /v1/stock/low-stock/thresholds` → `{ thresholds }`. CEO and Admin; a Coach gets nothing. */
export async function getLowStockThresholds(role: Role): Promise<LowStockThresholds> {
  if (role === "coach") return {};
  if (STOCK_SOURCE.lowStock === "api") {
    const { data } = await api.get<{ thresholds: LowStockThresholds }>("/v1/stock/low-stock/thresholds");
    return data?.thresholds && typeof data.thresholds === "object" ? data.thresholds : {};
  }
  return { ...thresholdRows() };
}

/**
 * Save the whole map: `PUT /v1/stock/low-stock/thresholds` with `{ thresholds }` → `{ thresholds }` (CEO and Admin). Each value is null (no alert) or a whole number ≥ 0 — anything else is refused
 * on the screen's side first (`INVALID`, nothing sent) and by the route (400 VALIDATION with the issues).
 */
export async function setLowStockThresholds(role: Role, next: LowStockThresholds): Promise<LowStockThresholds> {
  if (role === "coach") throw new StockWriteError("FORBIDDEN", "Not allowed");
  for (const [key, v] of Object.entries(next)) {
    if (!key.trim() || (v !== null && (!Number.isInteger(v) || v < 0))) throw new StockWriteError("INVALID", `Alert (Unit) of ${key} must be a whole number, 0 or more`);
  }
  if (STOCK_SOURCE.lowStock === "api") {
    try {
      const { data } = await api.put<{ thresholds: LowStockThresholds }>("/v1/stock/low-stock/thresholds", { thresholds: next });
      return data?.thresholds ?? next;
    } catch (e) {
      return asStockWriteError(e);
    }
  }
  thresholds = { ...next };
  return { ...thresholds };
}
