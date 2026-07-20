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
  externalRef?: string;
  externalSource?: string;
}

export interface MovementInput {
  direction: StockDirection;
  quantity: number;
  amountMinor?: number;
  reason?: string;
}

export async function listItems(params?: { itemType?: ItemType }): Promise<CatalogItem[]> {
  const { data } = await api.get<{ items: CatalogItem[] }>("/v1/catalog/items", { params });
  return data.items;
}

export async function createItem(input: CreateItemInput): Promise<CatalogItem> {
  const { data } = await api.post<CatalogItem>("/v1/catalog/items", input);
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
