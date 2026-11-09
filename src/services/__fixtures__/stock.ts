// TASK-905 — fixture for the Stock Out product picker (final-ui `mock/b-stock.ts`, typed in satang). ONLY `stock.service.ts` imports this file; no component does.
// The EXACT shape of TASK-904's `GET /v1/stock/products` (Sober, TASK-905 § Answers) — no location. Names are invented products (CONVENTIONS §2.8). Deleted when the endpoint is wired.
import type { StockProduct } from "@/types/app/stock";

const baht = (n: number) => n * 100;
const p = (id: string, code: string, name: string, category: string, price: number, quantity: number, group: [string, number] | null, active = true): StockProduct => ({
  id,
  code,
  name,
  category,
  priceSatang: baht(price),
  quantity,
  commissionGroup: group ? { name: group[0], amountSatang: null } : null, // the amount lives on the group (future task): null for now
  active,
});

export const STOCK_PRODUCTS_FIXTURE: StockProduct[] = [
  p("p1", "MIL-IN-001", "Miller inline skate — Seaworld", "Miller", 3900, 6, ["Miller skate", 100]),
  p("p2", "MIL-HEL-010", "Miller helmet — M", "Miller", 1290, 4, ["Miller helmet", 40]),
  p("p3", "MIL-PAD-011", "Miller pads set", "Miller", 990, 7, ["Miller pads", 40]),
  p("p4", "ANI-HEL-020", "Animal helmet — S", "Safety", 790, 9, ["Animal Helmet", 40]),
  p("p5", "INL-SK-030", "Inline skate — kids", "Inlineskate", 1990, 12, null),
  p("p6", "BIK-BAL-050", "Balance bike", "Bike", 3200, 5, ["Royal baby", 50]),
  p("p7", "FB-WAT-070", "Water 600 ml", "F&B", 20, 8, null),
  p("p8", "FB-SNK-071", "Snack", "F&B", 50, 21, null),
  p("p9", "OTH-SHT-080", "Shirt", "Other", 350, 5, null),
  p("p10", "OTH-SOC-081", "Sock", "Other", 120, 0, null), // sold out: listed, not pickable
  p("p11", "OTH-BAG-082", "Skate bag", "Other", 690, 3, ["Skate bag", 100]),
  p("p12", "OLD-HEL-099", "Old helmet (retired)", "Safety", 500, 2, null, false), // inactive: never offered
];
