import type { CartStubRow, StockProduct } from "@/types/app/stock";

// Pure rules of the Stock Out picker + its cart stub (TASK-905), so the screen only draws them.

/** What the picker shows (and searches) for a product: «MODEL-CODE · name». */
export const productLabel = (p: Pick<StockProduct, "code" | "name">): string => `${p.code} · ${p.name}`;

/**
 * REQ-5010 17a — the search box. Case-insensitive; every word typed must appear in the code or the name, in any order («mil hel» finds «MIL-HEL-010 · Miller helmet — M»).
 * An empty box lists everything. Mantine's own default would only match the label as ONE substring, so the picker hands THIS function to its `filter`.
 */
export function matchesQuery(p: Pick<StockProduct, "code" | "name">, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${p.code} ${p.name}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

export const filterProducts = <T extends Pick<StockProduct, "code" | "name">>(products: readonly T[], query: string): T[] => products.filter((p) => matchesQuery(p, query));

/** A sold-out product is listed (the balance is information) but cannot be added to a sale. */
export const isPickable = (p: Pick<StockProduct, "quantity" | "active">): boolean => p.active && p.quantity > 0;

/** Add a product to the cart stub: a second pick of the same product raises its quantity (never above the balance) instead of adding a duplicate row. */
export function addToCart(cart: readonly CartStubRow[], product: StockProduct): CartStubRow[] {
  if (!isPickable(product)) return [...cart];
  const at = cart.findIndex((r) => r.product.id === product.id);
  if (at === -1) return [...cart, { product, quantity: 1 }];
  return cart.map((r, i) => (i === at ? { ...r, quantity: Math.min(r.quantity + 1, product.quantity) } : r));
}

export const removeFromCart = (cart: readonly CartStubRow[], productId: string): CartStubRow[] => cart.filter((r) => r.product.id !== productId);

/** Whole satang → "3,900 ฿" (the final UI's `fmtBaht`). */
export const bahtText = (satang: number): string => `${Math.round(satang / 100).toLocaleString("en-US")} ฿`;
