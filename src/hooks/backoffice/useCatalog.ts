"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/services/catalog.service";
import type { ItemType } from "@/types/app/backoffice";

const KEY = {
  items: (t?: ItemType) => ["backoffice", "items", t ?? "all"] as const,
  movements: (id: string) => ["backoffice", "movements", id] as const,
};

export function useItems(itemType?: ItemType) {
  return useQuery({
    queryKey: KEY.items(itemType),
    queryFn: () => svc.listItems(itemType ? { itemType } : undefined),
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: svc.createItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backoffice", "items"] }),
  });
}

export function useApplyMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { itemId: string; input: svc.MovementInput }) =>
      svc.applyMovement(v.itemId, v.input),
    onSuccess: (_data, v) => {
      qc.invalidateQueries({ queryKey: ["backoffice", "items"] });
      qc.invalidateQueries({ queryKey: KEY.movements(v.itemId) });
      qc.invalidateQueries({ queryKey: ["backoffice", "pl"] });
    },
  });
}

export function useMovements(itemId: string | null) {
  return useQuery({
    queryKey: KEY.movements(itemId ?? ""),
    queryFn: () => svc.listMovements(itemId as string),
    enabled: !!itemId,
  });
}
