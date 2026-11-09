"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Grid, Group, NumberInput, Table, Text } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import { useAllStockProducts, useLowStockList, useLowStockThresholds, useSaveLowStockThresholds } from "./StockData";
import { draftOfThresholds, lowProducts, settingRows, validateThresholds } from "./low-stock-logic";
import { categoriesOf } from "./stock-product-logic";
import { useRole } from "@/context/RoleContext";
import { ErrorState, LoadingState } from "@/components/partials/Salary/parts";
import { PageTitle } from "@/components/partials/Salary/PeopleParts";
import type { LowStockRow, LowStockThresholds, StockProduct } from "@/types/app/stock";

/**
 * TASK-913 (REQ-120 R3.7) — LOW STOCK: the products whose balance is at or under the alert level of their TYPE, and the editable level per type («Alert (Unit)»).
 * Left: the settings (a box per type; empty = no alert; Save). Right: the list — MODEL CODE · PRODUCT NAME · CATEGORY · UNIT (the balance) · Alert (Unit) · Under by. A saved level re-filters the list.
 * The Monday message and who receives it are NOT here (a back-end job tied to Notifications). No money anywhere (R0). CEO + Admin.
 */
export function LowStockBody({
  products,
  thresholds,
  low: serverLow,
  onSave,
}: {
  products: StockProduct[];
  thresholds: LowStockThresholds;
  /** the list as the server answered it (`GET /v1/stock/low-stock`); left out ⇒ computed here by the same rule from `products` + `thresholds` */
  low?: LowStockRow[];
  onSave: (next: LowStockThresholds) => Promise<void>;
}) {
  const rows = settingRows(categoriesOf(products), thresholds);
  const [draft, setDraft] = useState<Record<string, string>>(draftOfThresholds(rows));
  const [bad, setBad] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const low: LowStockRow[] =
    serverLow ?? lowProducts(products, thresholds).map((l) => ({ id: l.product.id, code: l.product.code, name: l.product.name, category: l.product.category, quantity: l.product.quantity, threshold: l.threshold, under: l.under }));

  const save = async () => {
    const r = validateThresholds(draft);
    if ("errors" in r) return setBad(r.errors);
    setBad([]);
    setSaving(true);
    setError(null);
    try {
      await onSave(r.ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "—");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle title="Low Stock" />
      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card>
            <Text fw={600} mb="sm">
              Setting
            </Text>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Type</Table.Th>
                  <Table.Th ta="right">Alert (Unit)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.key} data-type-row={r.key}>
                    <Table.Td>{r.key}</Table.Td>
                    <Table.Td>
                      <Group justify="flex-end">
                        <NumberInput
                          aria-label={`Alert (Unit) of ${r.key}`}
                          w={90}
                          min={0}
                          allowDecimal={false}
                          allowNegative={false}
                          value={draft[r.key] ?? ""}
                          onChange={(v) => setDraft((d) => ({ ...d, [r.key]: String(v) }))}
                          error={bad.includes(r.key)}
                          data-threshold={r.key}
                        />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {error && (
              <Alert color="red" icon={<AlertTriangle size={16} />} variant="light" mt="sm" data-threshold-error>
                {error}
              </Alert>
            )}
            <Group justify="flex-end" mt="sm">
              <Button onClick={save} loading={saving} data-save>
                Save
              </Button>
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card padding={0}>
            <Group justify="space-between" p="md" pb="xs">
              <Text fw={600}>Low</Text>
              <Badge color="red" variant="light" data-low-count>
                {low.length} low
              </Badge>
            </Group>
            <Table.ScrollContainer minWidth={520}>
              <Table verticalSpacing="xs" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>MODEL CODE</Table.Th>
                    <Table.Th>PRODUCT NAME</Table.Th>
                    <Table.Th>CATEGORY</Table.Th>
                    <Table.Th ta="right">UNIT</Table.Th>
                    <Table.Th ta="right">Alert (Unit)</Table.Th>
                    <Table.Th ta="right">Under by</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {low.map((l) => (
                    <Table.Tr key={l.id} data-low-row={l.code}>
                      <Table.Td ff="monospace" fz="xs">
                        {l.code}
                      </Table.Td>
                      <Table.Td fw={600}>{l.name}</Table.Td>
                      <Table.Td>{l.category}</Table.Td>
                      <Table.Td ta="right">
                        <Badge color="red" variant="light">
                          {l.quantity}
                        </Badge>
                      </Table.Td>
                      <Table.Td ta="right" className="tabular-nums">
                        {l.threshold}
                      </Table.Td>
                      <Table.Td ta="right" className="tabular-nums">
                        {l.under}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {low.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text c="dimmed" size="sm" ta="center">
                          {/* PENDING (Porter): not in the final UI */}
                          No product is low
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Grid.Col>
      </Grid>
    </div>
  );
}

/** The route's page body: the products (every one, inactive too — the rule drops them) and the saved levels, saved through the fixture seam until the BE store exists. */
export default function LowStock() {
  const role = useRole();
  const products = useAllStockProducts(role);
  const th = useLowStockThresholds(role);
  const list = useLowStockList(role);
  const save = useSaveLowStockThresholds(role);
  if (products.isError) return <ErrorState error={products.error} onRetry={() => products.refetch()} />;
  if (th.isError) return <ErrorState error={th.error} onRetry={() => th.refetch()} />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  if (!role || !products.data || !th.data || !list.data) return <LoadingState />;
  return (
    <LowStockBody
      // re-seed the boxes when the saved levels (or the category list) change
      key={JSON.stringify(th.data) + categoriesOf(products.data).join("|")}
      products={products.data}
      thresholds={th.data}
      low={list.data}
      onSave={async (next) => void (await save.mutateAsync(next))}
    />
  );
}
