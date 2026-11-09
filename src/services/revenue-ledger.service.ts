import { api } from "@/lib/api/client";
import { USE_FAKE_REVENUE } from "@/components/partials/RevenueLedger/config";
import type {
  CreateEcaPaymentInput,
  CreateRefundInput,
  RefundResult,
  RefundSource,
  CreateCategoryInput,
  CreateLineInput,
  ListCategoriesParams,
  ListLinesParams,
  ListLinesResult,
  RevenueCategory,
  RevenueLine,
  RevenueSummary,
  SummaryParams,
} from "@/types/app/revenue-ledger";

// SPEC-098 §3. `api` already ends in `/api`, so the paths start at `/v1/revenue`.
const BASE = "/v1/revenue";

// The fake is loaded only when the dev constant is on, so the delivered bundle never carries it.
const fake = () => import("@/components/partials/RevenueLedger/fake");

export async function listCategories(params?: ListCategoriesParams): Promise<RevenueCategory[]> {
  if (USE_FAKE_REVENUE) return (await fake()).fakeListCategories(params);
  const { data } = await api.get<{ categories: RevenueCategory[] }>(`${BASE}/categories`, { params });
  return data.categories;
}

export async function createCategory(input: CreateCategoryInput): Promise<RevenueCategory> {
  if (USE_FAKE_REVENUE) return (await fake()).fakeCreateCategory(input);
  const { data } = await api.post<{ category: RevenueCategory }>(`${BASE}/categories`, input);
  return data.category;
}

export async function createLine(input: CreateLineInput): Promise<RevenueLine> {
  if (USE_FAKE_REVENUE) return (await fake()).fakeCreateLine(input);
  const { data } = await api.post<{ line: RevenueLine }>(`${BASE}/lines`, input);
  return data.line;
}

/** TASK-894 / TASK-893: the sales a refund can be written against (CEO only; at most 20, matched by student name). */
export async function listRefundSources(q: string): Promise<RefundSource[]> {
  if (USE_FAKE_REVENUE) return (await fake()).fakeListRefundSources(q);
  const { data } = await api.get<{ sources: RefundSource[] }>(`${BASE}/refunds/sources`, { params: { q } });
  return data.sources;
}

/** TASK-894 / TASK-893: one refund = cancels the unattended sessions, tells the family, writes ONE negative REFUND line. */
export async function createRefund(input: CreateRefundInput): Promise<RefundResult> {
  if (USE_FAKE_REVENUE) return (await fake()).fakeCreateRefund(input);
  const { data } = await api.post<RefundResult>(`${BASE}/refunds`, input);
  return data;
}

/** TASK-891 / TASK-890: one ECA school payment → one ECA revenue line. The history is `listLines({ type: "ECA" })`. */
export async function createEcaPayment(input: CreateEcaPaymentInput): Promise<RevenueLine> {
  if (USE_FAKE_REVENUE) return (await fake()).fakeCreateEca(input);
  const { data } = await api.post<{ line: RevenueLine }>(`${BASE}/eca`, input);
  return data.line;
}

export async function listLines(params: ListLinesParams): Promise<ListLinesResult> {
  if (USE_FAKE_REVENUE) return (await fake()).fakeListLines(params);
  const { data } = await api.get<ListLinesResult>(`${BASE}/lines`, { params });
  return data;
}

export async function getSummary(params: SummaryParams): Promise<RevenueSummary> {
  if (USE_FAKE_REVENUE) return (await fake()).fakeGetSummary(params);
  const { data } = await api.get<RevenueSummary>(`${BASE}/summary`, { params });
  return data;
}
