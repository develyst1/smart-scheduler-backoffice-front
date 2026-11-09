// Stock DEMO — the data seam (TASK-918). WIRED to the live backoffice (BB 693627d, TASK-915): `STOCK_DEMO_SOURCE.demo` is "api"; the stateful fixture (which behaves like the routes: reason required,
// balances never below zero, idempotent on `key`, history kept) stays behind it for the tests. No component imports the fixture. CEO and Admin only (a Coach gets 403 before any request).
//   GET /v1/demo/stock → { sites, items }          GET /v1/demo/movements?from&to&limit → { items }        POST /v1/demo/{move,defect-in,delete} → { occurredOn, balances, movementsWritten, alreadyApplied? }
//   POST /v1/demo/sites { name } → 201 site         PUT /v1/demo/sites/order { ids } → { ids }              errors: the envelope; 409 NEGATIVE_BALANCE details {itemId, siteId, name, resultingBalance}
import { api, ApiClientError } from "@/lib/api/client";
import { makeDemoFixture, type DemoFixtureStore } from "@/services/__fixtures__/stock-demo";
import type { Role } from "@/types/app/roles";
import type {
  DemoDefectInput,
  DemoDeleteInput,
  DemoMoveInput,
  DemoMovement,
  DemoSite,
  DemoStock,
  DemoWriteResult,
} from "@/types/app/stock-demo";

export const STOCK_DEMO_SOURCE: Record<"demo", "fixture" | "api"> = { demo: "api" };
const live = () => STOCK_DEMO_SOURCE.demo === "api";

/** The History window the screen asks for: the last 366 days ending today (Bangkok) — the route's own maximum span (365 days between the ends, both inclusive). */
export function historyWindow(todayBangkok: string): { from: string; to: string } {
  const d = new Date(`${todayBangkok}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 365);
  return { from: d.toISOString().slice(0, 10), to: todayBangkok };
}
const bangkokToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const DEMO_HISTORY_LIMIT = 200;

let store: DemoFixtureStore = makeDemoFixture();
const applied = new Map<string, DemoWriteResult>();
let seq = 100;

/** Tests only: put the fixture back to its start. */
export function resetStockDemoFixture(): void {
  store = makeDemoFixture();
  applied.clear();
  seq = 100;
}

const guard = (role: Role | null) => {
  if (role !== "ceo" && role !== "admin") throw new ApiClientError("FORBIDDEN", "ไม่มีสิทธิ์เข้าถึงสต๊อก Demo", 403);
};
const bad = (message: string, field: string) => new ApiClientError("VALIDATION", message, 400, { field });
const today = () => new Date().toISOString().slice(0, 10);

const itemOf = (id: string) => {
  const it = store.items.find((x) => x.id === id);
  if (!it) throw new ApiClientError("NOT_FOUND", "ไม่พบสินค้านี้", 404);
  return it;
};
const siteOf = (id: string) => {
  const s = store.sites.find((x) => x.id === id);
  if (!s) throw new ApiClientError("NOT_FOUND", "ไม่พบสถานที่นี้", 404);
  return s;
};
const checkCommon = (key: string, qty: number | undefined, reason: string) => {
  if (!/^[A-Za-z0-9_.-]{8,100}$/.test(key)) throw bad("key ไม่ถูกต้อง", "key");
  if (qty !== undefined && (!Number.isSafeInteger(qty) || qty < 1)) throw bad("qty ต้องเป็นจำนวนเต็มตั้งแต่ 1", "qty");
  if (!reason.trim()) throw bad("ต้องบอกเหตุผล ระบบเก็บประวัติไว้", "reason");
};
const recount = (it: { balances: Record<string, number>; total: number }) => {
  it.total = Object.values(it.balances).reduce((a, b) => a + b, 0);
};
const refuse = (item: { id: string; name: string }, siteId: string, have: number, qty: number) =>
  new ApiClientError("NEGATIVE_BALANCE", `${item.name}: ที่สถานที่นี้เหลือ ${have} ชิ้น ตัดออก ${qty} ไม่ได้`, 409, { itemId: item.id, siteId, name: item.name, resultingBalance: have - qty });
const log = (m: Omit<DemoMovement, "id" | "occurredOn" | "who">) => {
  store.history.unshift({ id: `m${++seq}`, occurredOn: today(), who: "Ploy", ...m });
};
const once = (key: string, run: () => DemoWriteResult): DemoWriteResult => {
  const prev = applied.get(key);
  if (prev) return { ...prev, movementsWritten: 0, alreadyApplied: true };
  const out = run();
  applied.set(key, out);
  return out;
};

export async function getDemoStock(role: Role | null): Promise<DemoStock> {
  guard(role);
  if (live()) {
    const { data } = await api.get<Partial<DemoStock>>("/v1/demo/stock");
    return { sites: Array.isArray(data?.sites) ? data.sites : [], items: Array.isArray(data?.items) ? data.items : [] };
  }
  return structuredClone({ sites: [...store.sites].sort((a, b) => a.sortOrder - b.sortOrder), items: store.items });
}

export async function listDemoMovements(role: Role | null): Promise<DemoMovement[]> {
  guard(role);
  if (live()) {
    const { data } = await api.get<{ items?: DemoMovement[] }>("/v1/demo/movements", { params: { ...historyWindow(bangkokToday()), limit: DEMO_HISTORY_LIMIT } });
    return Array.isArray(data?.items) ? data.items : [];
  }
  return structuredClone(store.history);
}

export async function moveDemo(i: DemoMoveInput, role: Role | null): Promise<DemoWriteResult> {
  guard(role);
  if (live()) {
    const { data } = await api.post<DemoWriteResult>("/v1/demo/move", { key: i.key, itemId: i.itemId, fromSiteId: i.fromSiteId, toSiteId: i.toSiteId, qty: i.qty, reason: i.reason.trim() });
    return data;
  }
  checkCommon(i.key, i.qty, i.reason);
  if (i.fromSiteId === i.toSiteId) throw bad("ต้นทางและปลายทางต้องไม่ซ้ำกัน", "toSiteId");
  return once(`move:${i.key}`, () => {
    const it = itemOf(i.itemId);
    const from = siteOf(i.fromSiteId);
    const to = siteOf(i.toSiteId);
    const have = it.balances[from.id] ?? 0;
    if (i.qty > have) throw refuse(it, from.id, have, i.qty);
    it.balances[from.id] = have - i.qty;
    it.balances[to.id] = (it.balances[to.id] ?? 0) + i.qty;
    recount(it);
    log({ itemId: it.id, itemName: it.name, type: "MOVE", qty: i.qty, from: from.name, to: to.name, reason: i.reason.trim() });
    return { occurredOn: today(), balances: { ...it.balances }, movementsWritten: 1 };
  });
}

/** «Defect Product → Demo»: a plain +qty at a site. Nothing leaves sale stock (DECISIONS row 22). */
export async function defectInDemo(i: DemoDefectInput, role: Role | null): Promise<DemoWriteResult> {
  guard(role);
  if (live()) {
    const { data } = await api.post<DemoWriteResult>("/v1/demo/defect-in", { key: i.key, itemId: i.itemId, toSiteId: i.toSiteId, qty: i.qty, reason: i.reason.trim() });
    return data;
  }
  checkCommon(i.key, i.qty, i.reason);
  return once(`defect:${i.key}`, () => {
    const it = itemOf(i.itemId);
    const to = siteOf(i.toSiteId);
    it.balances[to.id] = (it.balances[to.id] ?? 0) + i.qty;
    recount(it);
    log({ itemId: it.id, itemName: it.name, type: "DEFECT_IN", qty: i.qty, from: "Defect Product", to: to.name, reason: i.reason.trim() });
    return { occurredOn: today(), balances: { ...it.balances }, movementsWritten: 1 };
  });
}

/** Partial (siteId + qty) takes pieces off one site; whole (neither) zeroes every site and deactivates the item. The history stays either way. */
export async function deleteDemo(i: DemoDeleteInput, role: Role | null): Promise<DemoWriteResult> {
  guard(role);
  if (live()) {
    // partial = siteId + qty together; whole = neither (the server refuses only one of them with a 400)
    const body = { key: i.key, itemId: i.itemId, reason: i.reason.trim(), ...(i.siteId !== undefined ? { siteId: i.siteId } : {}), ...(i.qty !== undefined ? { qty: i.qty } : {}) };
    const { data } = await api.post<DemoWriteResult>("/v1/demo/delete", body);
    return data;
  }
  checkCommon(i.key, i.qty, i.reason);
  if ((i.siteId === undefined) !== (i.qty === undefined)) throw bad("ส่ง siteId และ qty มาด้วยกัน หรือไม่ส่งทั้งคู่ (ลบทั้งรายการ)", "qty");
  return once(`delete:${i.key}`, () => {
    const it = itemOf(i.itemId);
    if (i.siteId !== undefined && i.qty !== undefined) {
      const site = siteOf(i.siteId);
      const have = it.balances[site.id] ?? 0;
      if (i.qty > have) throw refuse(it, site.id, have, i.qty);
      it.balances[site.id] = have - i.qty;
      recount(it);
      log({ itemId: it.id, itemName: it.name, type: "WRITE_OFF", qty: i.qty, from: site.name, to: "Deleted", reason: i.reason.trim() });
      return { occurredOn: today(), balances: { ...it.balances }, movementsWritten: 1 };
    }
    let written = 0;
    for (const s of store.sites) {
      const have = it.balances[s.id] ?? 0;
      if (have > 0) {
        log({ itemId: it.id, itemName: it.name, type: "WRITE_OFF", qty: have, from: s.name, to: "Deleted", reason: i.reason.trim() });
        written += 1;
      }
      it.balances[s.id] = 0;
    }
    recount(it);
    store.items = store.items.filter((x) => x.id !== it.id);
    return { occurredOn: today(), balances: { ...it.balances }, movementsWritten: written };
  });
}

/** A new location, appended last. A name that exists (case-insensitive) is a 409 DUPLICATE_SITE. */
export async function addDemoSite(name: string, role: Role | null): Promise<DemoSite> {
  guard(role);
  if (live()) {
    const { data } = await api.post<DemoSite>("/v1/demo/sites", { name: name.trim() });
    return data;
  }
  const n = name.trim();
  if (!n || n.length > 60) throw bad("ชื่อสถานที่ต้องไม่ว่างและไม่เกิน 60 ตัวอักษร", "name");
  if (store.sites.some((s) => s.name.toLowerCase() === n.toLowerCase())) throw new ApiClientError("DUPLICATE_SITE", `มีสถานที่ «${n}» อยู่แล้ว`, 409, { name: n });
  const site: DemoSite = { id: `site-${++seq}`, name: n, sortOrder: store.sites.length + 1 };
  store.sites.push(site);
  for (const it of store.items) it.balances[site.id] = 0;
  return structuredClone(site);
}

/** The whole list of site ids, in the new left-to-right order (exactly the active sites, no repeats). */
export async function orderDemoSites(ids: string[], role: Role | null): Promise<string[]> {
  guard(role);
  if (live()) {
    const { data } = await api.put<{ ids?: string[] }>("/v1/demo/sites/order", { ids });
    return Array.isArray(data?.ids) ? data.ids : ids;
  }
  if (ids.length !== store.sites.length || new Set(ids).size !== ids.length || ids.some((id) => !store.sites.some((s) => s.id === id))) throw bad("ids ต้องเป็นสถานที่ทั้งหมด ไม่ซ้ำ", "ids");
  ids.forEach((id, idx) => {
    siteOf(id).sortOrder = idx + 1;
  });
  return [...ids];
}
