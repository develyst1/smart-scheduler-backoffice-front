// Stock DEMO — fixture of TASK-915's reads (final-ui `mock/b-stock.ts` shape, re-keyed by ids as the real route is). ONLY `stock-demo.service.ts` imports this file; no component does.
// 🟡 Names are invented (CONVENTIONS §2.8). The wiring TASK swaps the service body and deletes this file.
import type { DemoMovement, DemoSite, DemoStockItem } from "@/types/app/stock-demo";

export interface DemoFixtureStore {
  sites: DemoSite[];
  /** active items; a deleted item leaves this list (the history keeps it) */
  items: DemoStockItem[];
  history: DemoMovement[];
}

const SITE_NAMES = ["Bravo", "STA", "RIS", "ABC", "Abbey"];
const ITEMS: Array<[string, string, number[]]> = [
  ["Inline skate — size 30-33", "Inlineskate", [4, 2, 0, 1, 0]],
  ["Helmet — M", "Safety", [6, 3, 2, 0, 1]],
  ["Knee pads set", "Safety", [3, 0, 1, 2, 0]],
  ["Balance bike", "Bike", [2, 1, 0, 0, 0]],
  ["Cone set", "Training", [10, 4, 4, 2, 2]],
];

export function makeDemoFixture(): DemoFixtureStore {
  const sites = SITE_NAMES.map((name, i) => ({ id: `site-${i + 1}`, name, sortOrder: i + 1 }));
  const items: DemoStockItem[] = ITEMS.map(([name, category, qty], i) => {
    const balances = Object.fromEntries(sites.map((s, j) => [s.id, qty[j] ?? 0]));
    return { id: `item-${i + 1}`, category, name, remark: null, balances, total: Object.values(balances).reduce((a, b) => a + b, 0) };
  });
  const history: DemoMovement[] = [
    { id: "m2", occurredOn: "2026-11-05", who: "Ploy", itemId: "item-2", itemName: "Helmet — M", type: "MOVE", qty: 2, from: "Bravo", to: "STA", reason: "STA class needs more" },
    { id: "m1", occurredOn: "2026-11-02", who: "Ploy", itemId: "item-3", itemName: "Knee pads set", type: "DEFECT_IN", qty: 1, from: "Defect Product", to: "RIS", reason: "strap torn, fine to teach with" },
  ];
  return { sites, items, history };
}
