"use client";

import { Group, Select, Text, type ComboboxItem, type OptionsFilter, type SelectProps } from "@mantine/core";
import { bahtText, isPickable, matchesQuery, productLabel } from "./stock-picker-logic";
import type { StockProduct } from "@/types/app/stock";

/**
 * TASK-905 — the Stock Out PRODUCT PICKER with its search box (REQ-5010 17a: «it's the sell page — we need a search box to find the item to sell»).
 * One searchable Select: type to filter on the Model code and the name (every word typed must appear, any order); each row shows «CODE · name», the price and the balance;
 * a sold-out product is listed but disabled. A pick calls `onAdd(product)` and the box clears, ready for the next item.
 */
export default function StockProductPicker({
  products,
  onAdd,
  selectProps,
  pickable = isPickable,
}: {
  products: StockProduct[];
  onAdd: (p: StockProduct) => void;
  /** which products can be picked: a SALE needs stock (the default); a RECEIVE (TASK-912) takes any active product, sold-out included */
  pickable?: (p: StockProduct) => boolean;
  /** extra Select props — the tests force the list open and type into the box with these */
  selectProps?: Partial<SelectProps>;
}) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const data: ComboboxItem[] = products.map((p) => ({ value: p.id, label: productLabel(p), disabled: !pickable(p) }));
  // Mantine's default filter matches the label as ONE substring; this one is the rule in `stock-picker-logic.ts`.
  const filter: OptionsFilter = ({ options, search }) =>
    (options as ComboboxItem[]).filter((o) => {
      const p = byId.get(o.value);
      return p ? matchesQuery(p, search) : false;
    });

  return (
    <Select
      label="Product"
      data={data}
      value={null}
      onChange={(id) => {
        const p = id ? byId.get(id) : undefined;
        if (p && pickable(p)) onAdd(p);
      }}
      searchable
      filter={filter}
      nothingFoundMessage="No product found" // PENDING (Porter): not in the final UI; the sold-out rule (listed but disabled) goes to Sober
      maxDropdownHeight={320}
      renderOption={({ option }) => {
        const p = byId.get(option.value);
        if (!p) return option.label;
        return (
          <Group justify="space-between" wrap="nowrap" gap="sm" w="100%" data-picker-option={p.code}>
            <Text size="sm" truncate style={{ minWidth: 0 }}>
              {productLabel(p)}
            </Text>
            <Group gap="md" wrap="nowrap">
              <Text size="sm" className="tabular-nums">
                {bahtText(p.priceSatang)}
              </Text>
              <Text size="sm" w={36} ta="right" className="tabular-nums" c={p.quantity === 0 ? "red" : "dimmed"}>
                {p.quantity}
              </Text>
            </Group>
          </Group>
        );
      }}
      data-stock-picker
      {...selectProps}
    />
  );
}
