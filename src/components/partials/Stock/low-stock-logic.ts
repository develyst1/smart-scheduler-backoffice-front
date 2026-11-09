import type { LowStockThresholds, StockProduct } from "@/types/app/stock";

// Pure rules of the Low Stock view and its thresholds (TASK-913, REQ-120 R3.7), so the screen only draws them.

/** The customer's defaults (R3.7): F&B 10 · Safety 1 · Miller 5 · Sock 1 · Shirt 1. A type that is not in the map has NO alert (null) — it is never low. */
export const DEFAULT_THRESHOLDS: LowStockThresholds = { "F&B": 10, Safety: 1, Miller: 5, Sock: 1, Shirt: 1 };

const norm = (s: string): string => s.trim().toLowerCase();

/**
 * Which threshold KEY a category falls under: the SAME name (trimmed, any case) — exactly the real rule of TASK-919 on the back end. No match ⇒ null (the type has no alert).
 * (The first-word guess of the fixture era is gone: the real categories come from the 904 import, and the Setting panel lists every one of them.)
 */
export function typeKeyFor(category: string, keys: readonly string[]): string | null {
  const c = norm(category);
  return keys.find((k) => norm(k) === c) ?? null;
}

/** A category's alert level: its type's number, or null (no alert) when its type has none or no type matches. */
export function thresholdOf(category: string, th: LowStockThresholds): number | null {
  const key = typeKeyFor(category, Object.keys(th));
  return key === null ? null : (th[key] ?? null);
}

export interface LowRow {
  product: StockProduct;
  threshold: number;
  /** how far under the alert level: threshold − quantity (0 when exactly at it) */
  under: number;
}

/**
 * Low Stock = the ACTIVE products whose quantity ≤ the threshold of their type. A product out of stock (0) is low whenever its type HAS a threshold (0 ≤ any threshold ≥ 0);
 * a type with no threshold is never low. Sorted by category, then by how far under (most first), then by name.
 */
export function lowProducts(products: readonly StockProduct[], th: LowStockThresholds): LowRow[] {
  const rows: LowRow[] = [];
  for (const product of products) {
    if (!product.active) continue;
    const threshold = thresholdOf(product.category, th);
    if (threshold !== null && product.quantity <= threshold) rows.push({ product, threshold, under: threshold - product.quantity });
  }
  return rows.sort((a, b) => a.product.category.localeCompare(b.product.category) || b.under - a.under || a.product.name.localeCompare(b.product.name));
}

/** The settings panel's rows: every type in the map (the customer's five first), then each category that matches NO type (so a new category can be given a level). */
export function settingRows(categories: readonly string[], th: LowStockThresholds): { key: string; value: number | null }[] {
  const keys = Object.keys(th);
  const extra = [...new Set(categories.map((c) => c.trim()).filter(Boolean))].filter((c) => typeKeyFor(c, keys) === null).sort((a, b) => a.localeCompare(b));
  return [...keys.map((key) => ({ key, value: th[key] ?? null })), ...extra.map((key) => ({ key, value: null }))];
}

/** The boxes' text → the map to save, or the types whose box is wrong: empty = no alert (null); otherwise a whole number ≥ 0. */
export function validateThresholds(draft: Record<string, string>): { ok: LowStockThresholds } | { errors: string[] } {
  const ok: LowStockThresholds = {};
  const errors: string[] = [];
  for (const [key, text] of Object.entries(draft)) {
    const t = text.trim();
    if (t === "") ok[key] = null;
    else if (/^\d+$/.test(t)) ok[key] = Number(t);
    else errors.push(key);
  }
  return errors.length > 0 ? { errors } : { ok };
}

export const draftOfThresholds = (rows: readonly { key: string; value: number | null }[]): Record<string, string> => Object.fromEntries(rows.map((r) => [r.key, r.value === null ? "" : String(r.value)]));
