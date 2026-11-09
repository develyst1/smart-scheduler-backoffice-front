"use client";

import { useState } from "react";
import { Badge, Button, Card, Group, Table, Tabs, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Plus } from "lucide-react";
import ProductFormModal from "./ProductFormModal";
import { useAllStockProducts, useCreateStockProduct, useUpdateStockProduct } from "./StockData";
import { bahtText } from "./stock-picker-logic";
import { categoriesOf, commissionText, filterByCategory } from "./stock-product-logic";
import { useRole } from "@/context/RoleContext";
import { ErrorState, LoadingState, errorMessage } from "@/components/partials/Salary/parts";
import { PageTitle, notifyOk } from "@/components/partials/Salary/PeopleParts";
import type { StockProduct, StockProductInput } from "@/types/app/stock";

/**
 * SALES › Product (STOCK; CEO + Admin) — the product list (final-ui `stock/Product.tsx`): a category tab bar, then MODEL CODE · CATEGORY · PRODUCT NAME · COMMISSION · PRICE · UNIT · ACTIVE, with Add / Edit.
 * REQ-5010 15a: the balance column reads «UNIT». No location, no branch, no transfer (15b is parked). A product with a balance of 0 stays listed, greyed.
 * Parts of the final UI left out on purpose: the picture, the note, «Add category» (type a new category in the form), «Import from Excel» (its own page) and the Location filter.
 */
export function StockProductsBody({
  products,
  onCreate,
  onUpdate,
}: {
  products: StockProduct[];
  onCreate: (input: StockProductInput) => Promise<void>;
  onUpdate: (id: string, input: StockProductInput) => Promise<void>;
}) {
  const [cat, setCat] = useState<string | null>(null);
  const [form, setForm] = useState<null | { product: StockProduct | null }>(null);
  const cats = categoriesOf(products);
  const shown = filterByCategory(products, cat);

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle
        title="Product"
        actions={
          <Button leftSection={<Plus size={16} />} onClick={() => setForm({ product: null })}>
            Add product
          </Button>
        }
      />
      <Card p="xs" mb="md">
        <Tabs value={cat ?? "All"} onChange={(v) => setCat(!v || v === "All" ? null : v)} variant="pills">
          <Tabs.List>
            {["All", ...cats].map((c) => (
              <Tabs.Tab key={c} value={c} data-category-tab={c}>
                {c}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </Card>
      <Card padding={0}>
        <Table.ScrollContainer minWidth={820}>
          <Table highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>MODEL CODE</Table.Th>
                <Table.Th>CATEGORY</Table.Th>
                <Table.Th>PRODUCT NAME</Table.Th>
                <Table.Th>COMMISSION</Table.Th>
                <Table.Th ta="right">PRICE</Table.Th>
                <Table.Th ta="right">UNIT</Table.Th>
                <Table.Th>ACTIVE</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shown.map((p) => (
                <Table.Tr key={p.id} data-product-row={p.code} c={p.quantity === 0 || !p.active ? "dimmed" : undefined}>
                  <Table.Td fz="xs" ff="monospace">
                    {p.code}
                  </Table.Td>
                  <Table.Td>{p.category}</Table.Td>
                  <Table.Td fw={600}>{p.name}</Table.Td>
                  <Table.Td>
                    {p.commissionGroup ? (
                      <Badge variant="light" color="violet" radius="sm" tt="none" w="max-content" maw="none">
                        {commissionText(p.commissionGroup)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </Table.Td>
                  <Table.Td ta="right" className="tabular-nums">
                    {bahtText(p.priceSatang)}
                  </Table.Td>
                  <Table.Td ta="right" className="tabular-nums" c={p.quantity === 0 ? "red.7" : undefined} fw={p.quantity === 0 ? 700 : undefined}>
                    {p.quantity}
                  </Table.Td>
                  <Table.Td>{p.active ? "✓" : "—"}</Table.Td>
                  <Table.Td ta="right">
                    <Button size="compact-xs" variant="subtle" onClick={() => setForm({ product: p })}>
                      Edit
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
              {shown.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text c="dimmed" size="sm" ta="center">
                      {/* PENDING (Porter): not in the final UI */}
                      No product found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Group mt="xs">
        <Text size="xs" c="dimmed">
          {shown.length} / {products.length}
        </Text>
      </Group>
      {form && (
        <ProductFormModal
          key={form.product?.id ?? "new"}
          product={form.product}
          categories={cats}
          defaultCategory={cat ?? undefined}
          onClose={() => setForm(null)}
          onSave={(input) => (form.product ? onUpdate(form.product.id, input) : onCreate(input))}
        />
      )}
    </div>
  );
}

export default function StockProducts() {
  const role = useRole();
  const q = useAllStockProducts(role);
  const create = useCreateStockProduct(role);
  const update = useUpdateStockProduct(role);
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!role || !q.data) return <LoadingState />;
  // A refusal shows its sentence (red toast) and is re-thrown so the form stays open.
  const fail = (e: unknown) => {
    notifications.show({ color: "red", message: errorMessage(e) });
    throw e;
  };
  return (
    <StockProductsBody
      products={q.data}
      onCreate={async (input) => {
        await create.mutateAsync(input).catch(fail);
        notifyOk(`Product added: ${input.name} (${input.category})`); // Porter: the back office is English-only
      }}
      onUpdate={async (id, input) => {
        await update.mutateAsync({ id, patch: { name: input.name, category: input.category, priceSatang: input.priceSatang, commissionGroup: input.commissionGroup, active: input.active } }).catch(fail);
        notifyOk(`Product saved: ${input.name}`);
      }}
    />
  );
}
