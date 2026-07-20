// The only place that talks to the Finance API for catalog items + stock movements.
import { api } from "@/lib/api/client";
import type {
  CatalogItem,
  ItemGroup,
  ItemType,
  StockDirection,
  StockMovement,
} from "@/types/app/backoffice";

export interface CreateItemInput {
  sku: string;
  name: string;
  unit?: string;
  itemGroup: ItemGroup;
  itemType: ItemType;
  salePriceMinor: number;
  trackStock: boolean;
  reorderLevel?: number | null;
  externalRef?: string;
  externalSource?: string;
  metadata?: Record<string, unknown>;
}

export interface MovementInput {
  direction: StockDirection;
  quantity: number;
  amountMinor?: number;
  reason?: string;
  refType?: string;
}

export async function listItems(
  params?: { itemType?: ItemType; externalSource?: string; externalRef?: string },
): Promise<CatalogItem[]> {
  const { data } = await api.get<{ items: CatalogItem[] }>("/v1/catalog/items", { params });
  return data.items;
}

export async function createItem(input: CreateItemInput): Promise<CatalogItem> {
  const { data } = await api.post<CatalogItem>("/v1/catalog/items", input);
  return data;
}

export interface UpdateItemInput {
  name?: string;
  salePriceMinor?: number;
  reorderLevel?: number | null;
  active?: boolean;
  /** Shallow-merged server-side (TASK-009), so partial keys keep the rest (e.g. metadata.kind). */
  metadata?: Record<string, unknown>;
}

export async function updateItem(itemId: string, patch: UpdateItemInput): Promise<CatalogItem> {
  const { data } = await api.patch<CatalogItem>(`/v1/catalog/items/${itemId}`, patch);
  return data;
}

export async function applyMovement(itemId: string, input: MovementInput): Promise<StockMovement> {
  const { data } = await api.post<StockMovement>(`/v1/catalog/items/${itemId}/movements`, input);
  return data;
}

export async function listMovements(itemId: string): Promise<StockMovement[]> {
  const { data } = await api.get<{ items: StockMovement[] }>(
    `/v1/catalog/items/${itemId}/movements`,
    { params: { limit: 50 } },
  );
  return data.items;
}
