import type { StockProduct, StockProductInput } from "@/types/app/stock";

// Pure rules of the Stock Product page (TASK-907), so the screen only draws them.

/** The category tabs: the distinct categories of the products, A→Z. The page puts «All» first. */
export const categoriesOf = (products: readonly Pick<StockProduct, "category">[]): string[] =>
  [...new Set(products.map((p) => p.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** «All» (null) keeps everything; a category keeps its own products. A product with balance 0 stays (greyed by the page). */
export const filterByCategory = <T extends Pick<StockProduct, "category">>(products: readonly T[], category: string | null): T[] =>
  category === null ? [...products] : products.filter((p) => p.category === category);

/** Whole satang → the text a baht box holds: 129000 → "1290", 129050 → "1290.50" (integer maths, no float). */
export const satangToInput = (s: number): string => `${Math.floor(s / 100)}${s % 100 ? `.${String(s % 100).padStart(2, "0")}` : ""}`;

/** What the COMMISSION cell prints: «Miller skate —» (the group name, and its amount when the group has one — «—» until the managed-groups task), or «—» for no group. */
export const commissionText = (g: StockProduct["commissionGroup"]): string => (g ? `${g.name} ${g.amountSatang === null ? "—" : satangToInput(g.amountSatang)}` : "—");

/** A baht box → whole satang: a number ≥ 0 with at most 2 decimals; anything else is null (text is parsed, never multiplied as a float). */
export function bahtTextToSatang(text: string): number | null {
  const hit = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  return hit ? Number(hit[1]) * 100 + Number((hit[2] ?? "").padEnd(2, "0")) : null;
}

export interface ProductFormDraft {
  code: string;
  name: string;
  category: string;
  price: string;
  commissionName: string;
  active: boolean;
  openingQuantity: string;
}
export type ProductFormErrors = Partial<Record<"code" | "name" | "category" | "price" | "openingQuantity", true>>;

/**
 * The form → the write input, or the fields that are wrong (nothing is sent while any is). The commission is the GROUP NAME only (empty = no commission); the amount lives on the group (TASK-907 Q1b).
 * The opening balance is read on create only (an edit never changes the balance).
 */
export function validateProductForm(d: ProductFormDraft, creating: boolean): { input: StockProductInput } | { errors: ProductFormErrors } {
  const errors: ProductFormErrors = {};
  if (creating && !d.code.trim()) errors.code = true;
  if (!d.name.trim()) errors.name = true;
  if (!d.category.trim()) errors.category = true;
  const price = bahtTextToSatang(d.price);
  if (price === null) errors.price = true;
  const qtyText = d.openingQuantity.trim();
  const qty = qtyText === "" ? 0 : /^\d+$/.test(qtyText) ? Number(qtyText) : null;
  if (creating && qty === null) errors.openingQuantity = true;
  if (Object.keys(errors).length > 0) return { errors };
  return {
    input: {
      code: d.code.trim(),
      name: d.name.trim(),
      category: d.category.trim(),
      priceSatang: price as number,
      commissionGroup: d.commissionName.trim() === "" ? null : d.commissionName.trim(),
      active: d.active,
      ...(creating ? { openingQuantity: qty as number } : {}),
    },
  };
}

export const emptyDraft = (category = ""): ProductFormDraft => ({ code: "", name: "", category, price: "", commissionName: "", active: true, openingQuantity: "0" });

export const draftOf = (p: StockProduct): ProductFormDraft => ({
  code: p.code,
  name: p.name,
  category: p.category,
  price: satangToInput(p.priceSatang),
  commissionName: p.commissionGroup?.name ?? "",
  active: p.active,
  openingQuantity: "0",
});
