// Dev-only fake for SPEC-098 §3 (see config.ts). Data is the final UI mock (`b-revenue.ts`, example day 2026-10-16)
// converted to the API shapes. In-memory: a reload resets it. Loaded only when USE_FAKE_REVENUE is true.
import { ApiClientError } from "@/lib/api/client";
import {
  REVENUE_TYPES,
  type CreateCategoryInput,
  type CreateEcaPaymentInput,
  type CreateLineInput,
  type CreateRefundInput,
  type RefundResult,
  type RefundSource,
  type ListCategoriesParams,
  type ListLinesParams,
  type ListLinesResult,
  type RevenueBranch,
  type RevenueCategory,
  type RevenueLine,
  type RevenueLineType,
  type RevenueMethod,
  type RevenueSummary,
  type RevenueType,
  type SummaryBlock,
  type SummaryParams,
} from "@/types/app/revenue-ledger";

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// ── Categories: the v3 tree, 53 rows (SPEC-098 §2) ──
const SPORTS = ["Inline Skate", "Surfskate", "Skateboard", "Bike", "Balance Play", "Onewheel", "Freeskate", "Scooter"];
const TREE: Record<RevenueType, string[]> = {
  COURSE: [...SPORTS.flatMap((s) => ["Private", "Duo", "1 HR"].map((c) => `${s} · ${c}`)), "Balance Camp", "Birthday"],
  TRIAL: SPORTS.map((s) => `1st Trial (${s})`),
  VOUCHER: ["5 Hr", "10 Hr", "15 Hr"],
  ECA: ["STA", "RIS", "ABC", "ISB", "KIS"],
  SALES: ["Miller", "Inline Skate", "Bike", "Safety"],
  FNB: ["Drink", "Snack"],
  RENT: ["EQUIPMENT", "PARK"],
  OTHER: ["Shirt", "Sock", "Bag"],
};
let seq = 1;
const categories: RevenueCategory[] = REVENUE_TYPES.flatMap((type) =>
  TREE[type].map((name, i) => ({ id: uuid(seq++), type, name, sortOrder: i, active: true })),
);
const catId = (type: RevenueType, name: string) => categories.find((c) => c.type === type && c.name === name)?.id ?? null;

// ── Lines ──
type Row = [id: string, on: string, branch: RevenueBranch, type: RevenueLineType, cat: string | null, product: string, baht: number, method: RevenueMethod, remark: string];
const ROWS: Row[] = [
  ["t01", "2026-10-16", "BRAVO", "COURSE", "Inline Skate · Private", "Inline Private 10 Hr — น้องมะลิ", 9500, "TRANSFER", "Counted on the CONFIRM date"],
  ["t02", "2026-10-16", "BRAVO", "COURSE", "Skateboard · Duo", "Skateboard Duo 10 Hr — น้องภูมิ & น้องข้าวหอม", 11000, "CASH", ""],
  ["t03", "2026-10-16", "BRAVO", "TRIAL", "1st Trial (Inline Skate)", "1st Trial Inline Skate — น้องภูมิ", 600, "CASH", "Counted at confirm"],
  ["t04", "2026-10-16", "BRAVO", "VOUCHER", "10 Hr", "Voucher 10 Hr — น้องภูมิ", 8400, "TRANSFER", "Whole amount on the CONFIRM date"],
  ["t05", "2026-10-16", "BRAVO", "COURSE", "Balance Camp", "Balance Camp, week 1 — น้องมะลิ", 4500, "TRANSFER", "Counted on the “Confirm camp” date"],
  ["t06", "2026-10-16", "BRAVO", "COURSE", "Birthday", "Birthday party (Other booking)", 6000, "TRANSFER", "Typed by hand"],
  ["t07", "2026-10-16", "BRAVO", "ECA", "STA", "Term 2", 36000, "TRANSFER", "400 ฿ × 18 students × 5 classes"],
  ["e01", "2026-10-30", "BRAVO", "ECA", "RIS", "Term 2", 28800, "TRANSFER", "320 ฿ × 18 students × 5 classes"],
  ["t08", "2026-10-16", "BRAVO", "RENT", "EQUIPMENT", "Equipment rent — hall, 2 hours", 1500, "CASH", "From the Rental booking"],
  ["t09", "2026-10-16", "BRAVO", "RENT", "PARK", "Park fee (Other booking, teacher “No Teacher”)", 800, "CASH", "Charges and blocks the timetable"],
  ["t10", "2026-10-16", "BRAVO", "SALES", "Miller", "Miller inline skate — Seaworld", 3510, "TRANSFER", "From STOCK OUT · 10 % off this item"],
  ["t11", "2026-10-16", "BRAVO", "FNB", "Snack", "Snack × 3", 150, "TRANSFER", "From the same STOCK OUT bill"],
  ["t12", "2026-10-16", "BRAVO", "OTHER", "Sock", "Sock × 2", 240, "CASH", "From STOCK OUT"],
  ["t13", "2026-10-16", "OTHER", "OTHER", "Shirt", "Team shirt", 500, "TRANSFER", "Added manually"],
  ["t14", "2026-10-16", "BRAVO", "REFUND", null, "Refund — Inline Private 10 Hr (น้องข้าวหอม)", -5000, "TRANSFER", "An EXPENSE in the month of the refund"],
  ["y01", "2026-10-15", "BRAVO", "COURSE", "Surfskate · Private", "Surfskate Private 10 Hr — น้องใบบัว", 9500, "TRANSFER", "Counted on the CONFIRM date"],
  ["y02", "2026-10-15", "BRAVO", "SALES", "Safety", "Animal helmet — S", 790, "CASH", "From STOCK OUT"],
  ["y03", "2026-10-15", "BRAVO", "FNB", "Drink", "Water 600 ml × 2", 40, "CASH", "From STOCK OUT"],
  ["w01", "2026-10-14", "BRAVO", "SALES", "Bike", "Balance bike — scratched frame (defect)", 2800, "TRANSFER", "From STOCK OUT · −400 ฿ on this item"],
  ["w02", "2026-10-14", "BRAVO", "COURSE", "Skateboard · Duo", "Skateboard Duo 10 Hr — น้องข้าวหอม & น้องใบบัว", 11000, "CASH", ""],
];
const lines: RevenueLine[] = ROWS.map(([id, on, branch, type, cat, product, baht, method, remark]) => ({
  id,
  occurredOn: on,
  branch,
  type,
  categoryId: cat && type !== "REFUND" ? catId(type, cat) : null,
  categoryName: cat,
  productName: product,
  amountMinor: baht * 100,
  method,
  remark: remark || null,
  source: "MANUAL",
  createdAt: `${on}T09:00:00.000Z`,
}));

// ── Summary: the final UI's typed blocks for the example day; otherwise summed from the lines above ──
const mock = (rows: number[], refunds: number): SummaryBlock => ({
  rows: REVENUE_TYPES.map((type, i) => ({ type, amountMinor: rows[i] * 100 })),
  totalMinor: rows.reduce((s, n) => s + n, 0) * 100,
  refundsMinor: refunds * 100,
});
const MOCK_DAY = "2026-10-16";
const MOCK_SUMMARY: RevenueSummary = {
  date: MOCK_DAY,
  today: mock([31000, 600, 8400, 36000, 3510, 150, 2300, 740], -5000),
  mtd: mock([401000, 9600, 126000, 144000, 41300, 2815, 21900, 10860], -15000),
  ytd: mock([3732400, 98400, 1275000, 1260000, 402500, 31615, 214800, 99200], -96000),
};
function sumBlock(from: string, to: string, branch?: RevenueBranch): SummaryBlock {
  const inScope = lines.filter((l) => l.occurredOn >= from && l.occurredOn <= to && (!branch || l.branch === branch));
  const rows = REVENUE_TYPES.map((type) => ({
    type,
    amountMinor: inScope.filter((l) => l.type === type).reduce((s, l) => s + l.amountMinor, 0),
  }));
  return {
    rows,
    totalMinor: rows.reduce((s, r) => s + r.amountMinor, 0),
    refundsMinor: inScope.filter((l) => l.type === "REFUND").reduce((s, l) => s + l.amountMinor, 0),
  };
}

// ── The five endpoints ──
export async function fakeListCategories(params?: ListCategoriesParams): Promise<RevenueCategory[]> {
  await delay();
  return categories
    .filter((c) => (!params?.type || c.type === params.type) && (params?.includeInactive || c.active))
    .map((c) => ({ ...c }));
}

export async function fakeCreateCategory(input: CreateCategoryInput): Promise<RevenueCategory> {
  await delay();
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) {
    throw new ApiClientError("VALIDATION", "name must be 1–60 characters", 400);
  }
  if (categories.some((c) => c.type === input.type && c.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiClientError("CONFLICT", "category already exists", 409);
  }
  const sortOrder = categories.filter((c) => c.type === input.type).length;
  const made: RevenueCategory = { id: uuid(seq++), type: input.type, name, sortOrder, active: true };
  categories.push(made);
  return { ...made };
}

export async function fakeCreateLine(input: CreateLineInput): Promise<RevenueLine> {
  await delay();
  const cat = categories.find((c) => c.id === input.categoryId);
  if (!cat || cat.type !== input.type || !cat.active) {
    throw new ApiClientError("VALIDATION", "categoryId does not belong to this type", 400);
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new ApiClientError("VALIDATION", "amountMinor must be a positive integer", 400);
  }
  const made: RevenueLine = {
    id: `n${lines.length + 1}`,
    occurredOn: input.occurredOn,
    branch: input.branch,
    type: input.type,
    categoryId: cat.id,
    categoryName: cat.name,
    productName: input.productName?.trim() || cat.name,
    amountMinor: input.amountMinor,
    method: input.method,
    remark: input.remark?.trim() || null,
    source: "MANUAL",
    createdAt: new Date().toISOString(),
  };
  lines.unshift(made);
  return { ...made };
}

// TASK-891 / TASK-890 (`POST /eca`): ONE ECA line = price × students × classes, counted on `paidOn`. Same refusals as the API.
const INT32_MAX = 2147483647;
export async function fakeCreateEca(input: CreateEcaPaymentInput): Promise<RevenueLine> {
  await delay();
  const cat = categories.find((c) => c.id === input.categoryId);
  if (!cat || cat.type !== "ECA" || !cat.active) {
    throw new ApiClientError("VALIDATION", "categoryId must be an active ECA category", 400);
  }
  const term = input.term.trim();
  if (term.length < 1 || term.length > 40) throw new ApiClientError("VALIDATION", "term must be 1–40 characters", 400);
  if (![input.pricePerClassMinor, input.students, input.classesPerTerm].every((n) => Number.isInteger(n) && n > 0)) {
    throw new ApiClientError("VALIDATION", "price, students and classes must be whole numbers above 0", 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn)) throw new ApiClientError("VALIDATION", "paidOn must be YYYY-MM-DD", 400);
  const amountMinor = input.pricePerClassMinor * input.students * input.classesPerTerm;
  if (amountMinor > INT32_MAX) throw new ApiClientError("VALIDATION", "the total is too large", 400);
  const baht = (input.pricePerClassMinor / 100).toLocaleString("en-US");
  const made: RevenueLine = {
    id: `eca${lines.length + 1}`,
    occurredOn: input.paidOn,
    branch: input.branch ?? "BRAVO",
    type: "ECA",
    categoryId: cat.id,
    categoryName: cat.name,
    productName: term,
    amountMinor,
    method: input.method ?? "TRANSFER",
    remark: `${baht} ฿ × ${input.students} students × ${input.classesPerTerm} classes`,
    source: "ECA",
    createdAt: new Date().toISOString(),
  };
  lines.unshift(made);
  return { ...made };
}

// TASK-894 / TASK-893 (`GET /refunds/sources`, `POST /refunds`). The sources are the final UI's two (a course and a voucher) plus three that
// exercise the errors: one already refunded, one the API refuses at save (409), one whose scheduler call fails (502), one not configured (503).
const sources: RefundSource[] = [
  { refType: "COURSE", refId: "r-c1", label: "Inline Private 10 Hr — น้องข้าวหอม", soldOn: "2026-09-15", feeMinor: 950000, attended: 6, toCancel: 4, refunded: false },
  { refType: "VOUCHER", refId: "r-v1", label: "Voucher 10 Hr — น้องภูมิ", soldOn: "2026-10-02", feeMinor: 840000, attended: 3, toCancel: 7, refunded: false },
  { refType: "COURSE", refId: "r-c2", label: "Skateboard Duo 10 Hr — น้องใบบัว (already refunded)", soldOn: "2026-08-20", feeMinor: 1100000, attended: 10, toCancel: 0, refunded: true },
  { refType: "COURSE", refId: "r-c3", label: "Bike Private 6 Hr — น้องมะลิ (fake: refunded elsewhere, 409 on save)", soldOn: "2026-10-10", feeMinor: 649000, attended: 1, toCancel: 5, refunded: false },
  { refType: "COURSE", refId: "r-c4", label: "Surfskate Private 10 Hr — น้องพีพี (fake: scheduler down, 502 on save)", soldOn: "2026-10-12", feeMinor: 950000, attended: 2, toCancel: 8, refunded: false },
  { refType: "VOUCHER", refId: "r-v2", label: "Voucher 5 Hr — น้องมีมี่ (fake: not configured, 503 on save)", soldOn: "2026-10-14", feeMinor: 450000, attended: 0, toCancel: 5, refunded: false },
];

export async function fakeListRefundSources(q: string): Promise<RefundSource[]> {
  await delay();
  const needle = q.trim().toLowerCase();
  return sources.filter((s) => !needle || s.label.toLowerCase().includes(needle)).slice(0, 20).map((s) => ({ ...s }));
}

export async function fakeCreateRefund(input: CreateRefundInput): Promise<RefundResult> {
  await delay(500);
  const src = sources.find((s) => s.refType === input.refType && s.refId === input.refId);
  if (!src) throw new ApiClientError("NOT_FOUND", "sale not found", 404);
  if (!(Number.isInteger(input.amountMinor) && input.amountMinor > 0 && input.amountMinor <= src.feeMinor)) {
    throw new ApiClientError("VALIDATION", "the refund must be above 0 and not more than the fee", 400);
  }
  if (src.refunded || input.refId === "r-c3") throw new ApiClientError("ALREADY_REFUNDED", "this sale has already been refunded", 409);
  if (input.refId === "r-v2") throw new ApiClientError("NOT_CONFIGURED", "the scheduler link is not configured", 503);
  if (input.refId === "r-c4") throw new ApiClientError("SCHEDULER_ERROR", "the scheduler did not answer", 502);
  src.refunded = true;
  const line: RevenueLine = {
    id: `rf${lines.length + 1}`,
    occurredOn: input.refundedOn,
    branch: "BRAVO",
    type: "REFUND",
    categoryId: null,
    categoryName: null,
    productName: `Refund: ${src.label}`,
    amountMinor: -input.amountMinor,
    method: input.method,
    remark: input.remark?.trim() || null,
    source: "REFUND",
    createdAt: new Date().toISOString(),
  };
  lines.unshift(line);
  return { line: { ...line }, cancelledSessions: src.toCancel };
}

export async function fakeListLines(p: ListLinesParams): Promise<ListLinesResult> {
  await delay();
  const out = lines
    .filter(
      (l) =>
        l.occurredOn >= p.from &&
        l.occurredOn <= p.to &&
        (!p.branch || l.branch === p.branch) &&
        (!p.type || l.type === p.type) &&
        (!p.categoryId || l.categoryId === p.categoryId),
    )
    .sort((a, b) => (a.occurredOn === b.occurredOn ? b.createdAt.localeCompare(a.createdAt) : b.occurredOn.localeCompare(a.occurredOn)));
  const refundsMinor = out.filter((l) => l.type === "REFUND").reduce((s, l) => s + l.amountMinor, 0);
  const totalMinor = out.reduce((s, l) => s + l.amountMinor, 0);
  return { lines: out.map((l) => ({ ...l })), totalMinor, revenueMinor: totalMinor - refundsMinor, refundsMinor };
}

export async function fakeGetSummary(p: SummaryParams): Promise<RevenueSummary> {
  await delay();
  if (p.date === MOCK_DAY && !p.branch) return MOCK_SUMMARY;
  const month = `${p.date.slice(0, 7)}-01`;
  const year = `${p.date.slice(0, 4)}-01-01`;
  return {
    date: p.date,
    today: sumBlock(p.date, p.date, p.branch),
    mtd: sumBlock(month, p.date, p.branch),
    ytd: sumBlock(year, p.date, p.branch),
  };
}
