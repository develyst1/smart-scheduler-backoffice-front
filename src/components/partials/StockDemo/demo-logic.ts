import type { DemoNegativeDetails, DemoSite, DemoStock, DemoStockItem } from "@/types/app/stock-demo";

// Pure rules of the Stock Demo screen: the matrix, the form checks (the final UI's own Thai sentences) and the write keys. No React, so they are unit-tested.

/** The sites left to right by `sortOrder` (the server already sends them so; this keeps the matrix right if it ever does not). */
export const orderedSites = (stock: DemoStock): DemoSite[] => [...stock.sites].sort((a, b) => a.sortOrder - b.sortOrder);

/** The pieces of an item at a site (a missing site = 0). */
export const qtyAt = (item: DemoStockItem, siteId: string): number => item.balances[siteId] ?? 0;

/** The Total column: the sum over the sites on screen. */
export const totalOf = (item: DemoStockItem, sites: readonly DemoSite[]): number => sites.reduce((sum, s) => sum + qtyAt(item, s.id), 0);

/** A write key: 8-100 chars of A-Z a-z 0-9 _ . - (the server's rule). A new one per user action; a retry of the SAME action reuses it, so it cannot double-write. */
export function newWriteKey(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `fe-${Date.now().toString(36)}-${rand}`;
}

export interface ActionForm {
  itemId: string | null;
  qty: number;
  reason: string;
  fromSiteId?: string | null;
  toSiteId?: string | null;
}

export const MSG = {
  pickAndQty: "เลือกของและใส่จำนวนที่มากกว่า 0",
  needReason: "ต้องบอกเหตุผลก่อนบันทึก ระบบเก็บประวัติไว้",
  differentSites: "เลือกสถานที่ต้นทางและปลายทางที่ไม่ซ้ำกัน",
  needSite: "เลือกสถานที่",
  newSite: "ใส่ชื่อสถานที่ใหม่ที่ยังไม่มีในตาราง",
} as const;

/**
 * The checks the final UI runs before it writes: an item and a whole quantity above 0, a reason (the history keeps it), and for a move two different sites with enough pieces at A.
 * Returns the sentence to show, or null when the form may be sent. The server checks all of it again (400 / 409).
 */
export function checkForm(kind: "move" | "defect" | "delete-partial", f: ActionForm, stock: DemoStock): string | null {
  if (!f.itemId || !Number.isInteger(f.qty) || !(f.qty > 0)) return MSG.pickAndQty;
  if (!f.reason.trim()) return MSG.needReason;
  const item = stock.items.find((x) => x.id === f.itemId);
  const nameOf = (id: string | null | undefined) => stock.sites.find((s) => s.id === id)?.name ?? "";
  if (kind === "move") {
    if (!f.fromSiteId || !f.toSiteId || f.fromSiteId === f.toSiteId) return MSG.differentSites;
    const have = item ? qtyAt(item, f.fromSiteId) : 0;
    if (f.qty > have) return `${nameOf(f.fromSiteId)} มี ${item?.name ?? ""} ไม่พอ (เหลือ ${have})`;
  }
  if (kind === "delete-partial") {
    if (!f.fromSiteId) return MSG.needSite;
    const have = item ? qtyAt(item, f.fromSiteId) : 0;
    if (f.qty > have) return `${nameOf(f.fromSiteId)} มี ${item?.name ?? ""} ไม่พอ (เหลือ ${have})`;
  }
  if (kind === "defect" && !f.toSiteId) return MSG.needSite;
  return null;
}

/** The new site name is usable: not empty, not already a column (any case). */
export const siteNameOk = (name: string, sites: readonly DemoSite[]): boolean => {
  const n = name.trim().toLowerCase();
  return n.length > 0 && !sites.some((s) => s.name.toLowerCase() === n);
};

/** The ▲▼ of Location Order: the ids with the one at `index` swapped with its neighbour (`delta` ±1); unchanged at an edge. */
export function swapIds(ids: readonly string[], index: number, delta: -1 | 1): string[] {
  const j = index + delta;
  if (index < 0 || index >= ids.length || j < 0 || j >= ids.length) return [...ids];
  const out = [...ids];
  [out[index], out[j]] = [out[j], out[index]];
  return out;
}

/** `error.details` of a 409 NEGATIVE_BALANCE (`{itemId, siteId, name, resultingBalance}`); null for any other error or a malformed details object. */
export function demoNegativeDetails(error: unknown): DemoNegativeDetails | null {
  const e = error as { code?: unknown; details?: unknown } | null;
  if (e?.code !== "NEGATIVE_BALANCE") return null;
  const d = e.details as Partial<DemoNegativeDetails> | null | undefined;
  if (!d || typeof d.itemId !== "string" || typeof d.siteId !== "string" || typeof d.name !== "string" || typeof d.resultingBalance !== "number") return null;
  return { itemId: d.itemId, siteId: d.siteId, name: d.name, resultingBalance: d.resultingBalance };
}

/** The "From → To" cell of the History table. */
export const fromTo = (m: { from: string | null; to: string | null }): string => `${m.from ?? "—"} → ${m.to ?? "—"}`;
