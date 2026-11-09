// Stock DEMO (TASK-918, REQ-120 R3.6) — the types of Jason's TASK-915 reads/writes (`/v1/demo/*`, backoffice-back `routes/demo.ts`). No money exists on this screen.
export interface DemoSite {
  id: string;
  name: string;
  sortOrder: number;
}

/** One item of the matrix. `balances` is keyed by site id (a missing site = 0); `total` is the server's sum. */
export interface DemoStockItem {
  id: string;
  category: string;
  name: string;
  remark?: string | null;
  balances: Record<string, number>;
  total: number;
}

/** `GET /v1/demo/stock` — the sites left to right (Bravo first by default) and the ACTIVE items. */
export interface DemoStock {
  sites: DemoSite[];
  items: DemoStockItem[];
}

export type DemoMovementType = "MOVE" | "DEFECT_IN" | "WRITE_OFF" | "OPENING";

/** `GET /v1/demo/movements` row (newest first). `from` / `to` are site names, or "Defect Product" / "Opening" / "Deleted". */
export interface DemoMovement {
  id: string;
  /** the business day, YYYY-MM-DD */
  occurredOn: string;
  who: string | null;
  itemId: string;
  itemName: string;
  type: DemoMovementType;
  qty: number;
  from: string | null;
  to: string | null;
  reason: string | null;
}

/** Every write carries a client `key` (8-100 chars of A-Z a-z 0-9 _ . -): a repeat of the same key writes nothing. */
export interface DemoMoveInput {
  key: string;
  itemId: string;
  fromSiteId: string;
  toSiteId: string;
  qty: number;
  reason: string;
}
export interface DemoDefectInput {
  key: string;
  itemId: string;
  toSiteId: string;
  qty: number;
  reason: string;
}
/** With `siteId` + `qty` = a partial write-off; with neither = zero every site and deactivate the item. Sending only one of the two is a 400. */
export interface DemoDeleteInput {
  key: string;
  itemId: string;
  reason: string;
  siteId?: string;
  qty?: number;
}

export interface DemoWriteResult {
  occurredOn: string;
  balances: Record<string, number>;
  movementsWritten: number;
  alreadyApplied?: boolean;
}

/** `error.details` of a 409 NEGATIVE_BALANCE on the demo writes. */
export interface DemoNegativeDetails {
  itemId: string;
  siteId: string;
  name: string;
  resultingBalance: number;
}
