// The only place that talks to the rebuilt backoffice API (bo.*, REQ-006 / TASK-022),
// mounted at /api/v1/bo/*. Amounts are integer minor units (satang).
import { api } from "@/lib/api/client";
import type {
  BoItem,
  BoMovement,
  BoPLReport,
  Cadence,
  Direction,
  TagGroup,
  TagValue,
} from "@/types/app/bo";

export interface ListItemsParams {
  direction?: Direction;
  cadence?: Cadence;
  active?: boolean;
  tagValueId?: string;
}

export async function listItems(params?: ListItemsParams): Promise<BoItem[]> {
  const { data } = await api.get<{ items: BoItem[] }>("/v1/bo/items", { params });
  return data.items;
}

export interface CreateItemInput {
  name: string;
  unit?: string;
  direction: Direction;
  cadence?: Cadence;
  unitPriceMinor?: number;
  ceilingQty?: number | null;
  ownerRef?: string;
  metadata?: Record<string, unknown>;
}

export async function createItem(input: CreateItemInput): Promise<BoItem> {
  const { data } = await api.post<BoItem>("/v1/bo/items", input);
  return data;
}

export interface UpdateItemInput {
  name?: string;
  unitPriceMinor?: number;
  ceilingQty?: number | null;
  cadence?: Cadence;
  active?: boolean;
  metadata?: Record<string, unknown>;
}

export async function updateItem(id: string, patch: UpdateItemInput): Promise<BoItem> {
  const { data } = await api.patch<BoItem>(`/v1/bo/items/${id}`, patch);
  return data;
}

export interface MovementInput {
  qty: number; // signed: + in / − out
  reason?: string;
  allowNegative?: boolean;
}

export async function applyMovement(itemId: string, input: MovementInput): Promise<BoMovement> {
  const { data } = await api.post<BoMovement>(`/v1/bo/items/${itemId}/movements`, input);
  return data;
}

export async function listMovements(itemId: string): Promise<BoMovement[]> {
  const { data } = await api.get<{ items: BoMovement[] }>(`/v1/bo/items/${itemId}/movements`, {
    params: { limit: 50 },
  });
  return data.items;
}

export async function getPLReport(params?: { from?: string; to?: string }): Promise<BoPLReport> {
  const { data } = await api.get<BoPLReport>("/v1/bo/reports/pl", { params });
  return data;
}

// ── Tags ──
export async function listTagGroups(): Promise<TagGroup[]> {
  const { data } = await api.get<{ groups: TagGroup[] }>("/v1/bo/tag-groups");
  return data.groups;
}

export async function createTagGroup(input: { name: string; sortOrder?: number }): Promise<TagGroup> {
  const { data } = await api.post<TagGroup>("/v1/bo/tag-groups", input);
  return data;
}

export async function createTagValue(input: {
  tagGroupId: string;
  label: string;
  color?: string;
  sortOrder?: number;
}): Promise<TagValue> {
  const { data } = await api.post<TagValue>("/v1/bo/tag-values", input);
  return data;
}

export async function setItemTags(itemId: string, tagValueIds: string[]): Promise<void> {
  await api.put(`/v1/bo/items/${itemId}/tags`, { tagValueIds });
}
