"use client";

import { useState } from "react";
import { Autocomplete, Button, Grid, Group, Modal, Select, Stack, Switch, TextInput } from "@mantine/core";
import { draftOf, emptyDraft, revenueCategoryOptions, validateProductForm, type ProductFormDraft, type ProductFormErrors } from "./stock-product-logic";
import type { RevenueCategory, StockProduct, StockProductInput } from "@/types/app/stock";

/** The form's title: «Add product» for a new one, «Edit product» for an existing one. */
export const productFormTitle = (product: StockProduct | null): string => (product === null ? "Add product" : "Edit product");

/**
 * TASK-907 — the fields of «Add product» / «Edit product»: MODEL CODE (new only; the code is the product's identity), PRODUCT NAME, CATEGORY (pick one or type a new one), PRICE,
 * COMMISSION group (the NAME only; empty = none — the amount lives on the group, a future task), UNIT (the opening balance, new only: an edit never changes the balance) and ACTIVE. NO location, NO branch (a single location now).
 * Nothing is sent while a field is wrong (it turns red). `onSave` resolves ⇒ the form closes; it rejects ⇒ the caller already showed the sentence and the form stays.
 */
export function ProductFormBody({
  product,
  categories,
  revenueCategories = [],
  defaultCategory,
  onClose,
  onSave,
  saving = false,
}: {
  /** null = a new product */
  product: StockProduct | null;
  categories: string[];
  /** the revenue categories a sale of this product posts to (`GET /v1/stock/revenue-categories`) */
  revenueCategories?: RevenueCategory[];
  defaultCategory?: string;
  onClose: () => void;
  onSave: (input: StockProductInput) => Promise<void>;
  saving?: boolean;
}) {
  const creating = product === null;
  const [draft, setDraft] = useState<ProductFormDraft>(product ? draftOf(product) : emptyDraft(defaultCategory ?? ""));
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const set = (patch: Partial<ProductFormDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = async () => {
    const r = validateProductForm(draft, creating);
    if ("errors" in r) return setErrors(r.errors);
    setErrors({});
    try {
      await onSave(r.input);
      onClose();
    } catch {
      /* the caller showed the sentence; the form stays */
    }
  };

  return (
    <Stack>
      {creating && <TextInput label="MODEL CODE" value={draft.code} onChange={(e) => set({ code: e.currentTarget.value })} error={errors.code} data-autofocus data-field="code" />}
      <TextInput label="PRODUCT NAME" value={draft.name} onChange={(e) => set({ name: e.currentTarget.value })} error={errors.name} data-autofocus={!creating} data-field="name" />
      <Grid gap="sm">
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Autocomplete label="CATEGORY" data={categories} value={draft.category} onChange={(v) => set({ category: v })} error={errors.category} data-field="category" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput label="PRICE" value={draft.price} onChange={(e) => set({ price: e.currentTarget.value })} error={errors.price} rightSection="฿" inputMode="decimal" data-field="price" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput label="COMMISSION group" value={draft.commissionName} onChange={(e) => set({ commissionName: e.currentTarget.value })} data-field="commissionName" />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          {/* PENDING (Porter): «REVENUE CATEGORY» is a new word. Required on create; on an edit the current one is not shown (the list does not carry it) — leave it empty to keep it. */}
          <Select
            label="REVENUE CATEGORY"
            data={revenueCategoryOptions(revenueCategories)}
            value={draft.revenueCategoryId || null}
            onChange={(v) => set({ revenueCategoryId: v ?? "" })}
            placeholder={creating ? "Pick one" : "Keep current"}
            error={errors.revenueCategoryId}
            withAsterisk={creating}
            data-field="revenueCategoryId"
          />
        </Grid.Col>
        {creating && (
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="UNIT" value={draft.openingQuantity} onChange={(e) => set({ openingQuantity: e.currentTarget.value })} error={errors.openingQuantity} inputMode="numeric" data-field="openingQuantity" />
          </Grid.Col>
        )}
      </Grid>
      <Switch label="ACTIVE" checked={draft.active} onChange={(e) => set({ active: e.currentTarget.checked })} />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={saving}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}

export default function ProductFormModal(props: Parameters<typeof ProductFormBody>[0]) {
  return (
    <Modal opened onClose={props.onClose} title={productFormTitle(props.product)} centered>
      <ProductFormBody {...props} />
    </Modal>
  );
}
