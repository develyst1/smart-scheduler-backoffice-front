"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, Group, MultiSelect, NumberInput, Select, Table, Text, TextInput } from "@mantine/core";
import { AlertTriangle, Check } from "lucide-react";
import StockProductPicker from "./StockProductPicker";
import { useSellStockOut, useSellers, useStockProducts } from "./StockData";
import { bahtText } from "./stock-picker-logic";
import { DEFAULT_PAYMENT_METHOD, PAYMENT_METHOD_OPTIONS, addLine, buildSellRequest, cartIsValid, cartTotalSatang, checkLine, createKeyKeeper, removeLine, setLine, type SellLine } from "./stock-out-logic";
import { useRole } from "@/context/RoleContext";
import { ErrorState, LoadingState } from "@/components/partials/Salary/parts";
import { PageTitle } from "@/components/partials/Salary/PeopleParts";
import { NegativeBalanceError } from "@/services/stock.service";
import type { Role } from "@/types/app/roles";
import type { Seller, StockOutRequest, StockOutResult, StockPaymentMethod, StockProduct } from "@/types/app/stock";

export type SellOutcome = { kind: "sold"; result: StockOutResult; lines: number } | { kind: "refused"; model: string; name: string } | { kind: "error"; message: string };

/** The refusal's sentence: names the item, and says nothing was sold. (English wording: PENDING Porter.) */
export const refusalText = (model: string, name: string): string => `Not enough stock for ${model} (${name}) — nothing was sold`;

/**
 * TASK-910 — STOCK OUT, the sell screen: the product picker (TASK-905) → a cart (QTY, a per-item DISCOUNT, a per-item COMMISSION typed by hand — lower OR raise, no maths here) → a seller pick → Save.
 * 🔴 R0: the cart TOTAL is drawn for the CEO only; an Admin sees each line's price and the commission they type, never an aggregate. Save sends ONE `POST /v1/stock/out` with one idempotency key per confirmed cart;
 * a line that would drive a balance below 0 refuses the WHOLE sale (a red alert naming the item).
 */
export function StockOutSellBody({
  products,
  sellers,
  role,
  onSell,
  newKey = () => crypto.randomUUID(),
  initialCart = [],
  initialMethod = DEFAULT_PAYMENT_METHOD,
}: {
  products: StockProduct[];
  sellers: Seller[];
  role: Role;
  onSell: (req: StockOutRequest) => Promise<StockOutResult>;
  newKey?: () => string;
  /** a cart to start with — the tests render a filled cart with this */
  initialCart?: SellLine[];
  /** the payment method to start with (default Transfer); null = a cleared field — the tests render that */
  initialMethod?: StockPaymentMethod | null;
}) {
  const [cart, setCart] = useState<SellLine[]>(initialCart);
  const [sellerIds, setSellerIds] = useState<string[]>([]);
  // REQUIRED (the revenue line's method is NOT NULL): pre-filled with Transfer, so Save is closed only if the field is cleared
  const [method, setMethod] = useState<StockPaymentMethod | null>(initialMethod);
  const [outcome, setOutcome] = useState<SellOutcome | null>(null);
  const [saving, setSaving] = useState(false);
  // One key per confirmed cart: a second press of the same cart (a double click, a retry) reuses it, so it cannot sell twice. Any edit makes it a different cart.
  const key = useMemo(() => createKeyKeeper(newKey), []); // eslint-disable-line react-hooks/exhaustive-deps
  const edit = (next: SellLine[]) => {
    key.reset();
    setOutcome(null);
    setCart(next);
  };

  const confirm = async () => {
    if (saving || !cartIsValid(cart) || method === null) return;
    setSaving(true);
    try {
      const result = await onSell(buildSellRequest(cart, sellerIds, key.get(), method));
      setOutcome({ kind: "sold", result, lines: cart.length });
      setCart([]);
      setSellerIds([]);
      setMethod(DEFAULT_PAYMENT_METHOD);
      key.reset();
    } catch (e) {
      if (e instanceof NegativeBalanceError) setOutcome({ kind: "refused", model: e.model, name: e.productName });
      else setOutcome({ kind: "error", message: e instanceof Error ? e.message : "—" });
    } finally {
      setSaving(false);
    }
  };

  const ceo = role === "ceo";
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageTitle title="STOCK OUT" />
      {outcome?.kind === "sold" && (
        <Alert color="green" icon={<Check size={16} />} variant="light" data-sold>
          {outcome.result.saleId} · {outcome.lines} {outcome.lines === 1 ? "line" : "lines"}
        </Alert>
      )}
      {outcome?.kind === "refused" && (
        <Alert color="red" icon={<AlertTriangle size={16} />} variant="light" data-refused>
          {refusalText(outcome.model, outcome.name)}
        </Alert>
      )}
      {outcome?.kind === "error" && (
        <Alert color="red" icon={<AlertTriangle size={16} />} variant="light" data-sell-error>
          {outcome.message}
        </Alert>
      )}
      <Card padding="md">
        <StockProductPicker products={products} onAdd={(p) => edit(addLine(cart, p))} />
      </Card>
      {cart.length > 0 && (
        <Card padding={0} data-cart>
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="xs" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>MODEL CODE</Table.Th>
                  <Table.Th>PRODUCT NAME</Table.Th>
                  <Table.Th ta="right">PRICE</Table.Th>
                  <Table.Th w={96}>QTY</Table.Th>
                  <Table.Th w={130}>DISCOUNT</Table.Th>
                  <Table.Th w={130}>COMMISSION</Table.Th>
                  <Table.Th ta="right">LINE</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cart.map((l) => {
                  const c = checkLine(l);
                  return (
                    <Table.Tr key={l.product.id} data-cart-row={l.product.code}>
                      <Table.Td ff="monospace" fz="xs">
                        {l.product.code}
                      </Table.Td>
                      <Table.Td fw={600}>{l.product.name}</Table.Td>
                      <Table.Td ta="right" className="tabular-nums">
                        {bahtText(l.product.priceSatang)}
                      </Table.Td>
                      <Table.Td>
                        <NumberInput value={l.qty} onChange={(v) => edit(setLine(cart, l.product.id, { qty: Number(v) }))} min={1} max={l.product.quantity} allowDecimal={false} clampBehavior="strict" aria-label="QTY" data-qty />
                      </Table.Td>
                      <Table.Td>
                        <TextInput value={l.discount} onChange={(e) => edit(setLine(cart, l.product.id, { discount: e.currentTarget.value }))} error={c.errors.discount} placeholder="0" rightSection="฿" inputMode="decimal" aria-label="DISCOUNT" data-discount />
                      </Table.Td>
                      <Table.Td>
                        <TextInput value={l.commission} onChange={(e) => edit(setLine(cart, l.product.id, { commission: e.currentTarget.value }))} error={c.errors.commission} placeholder="—" rightSection="฿" inputMode="decimal" aria-label="COMMISSION" data-commission />
                      </Table.Td>
                      <Table.Td ta="right" fw={600} className="tabular-nums" data-line-total>
                        {bahtText(c.totalSatang)}
                      </Table.Td>
                      <Table.Td ta="right">
                        <Button size="compact-xs" variant="subtle" onClick={() => edit(removeLine(cart, l.product.id))}>
                          Remove
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {ceo && (
                  <Table.Tr data-cart-total>
                    <Table.Td colSpan={6} fw={700}>
                      Total
                    </Table.Td>
                    <Table.Td ta="right" fw={700} className="tabular-nums">
                      {bahtText(cartTotalSatang(cart))}
                    </Table.Td>
                    <Table.Td />
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      {cart.length > 0 && (
        <Card padding="md">
          <Group align="flex-end" justify="space-between" wrap="wrap">
            <MultiSelect label="Seller" data={sellers.map((s) => ({ value: s.id, label: s.name }))} value={sellerIds} onChange={setSellerIds} searchable w={320} data-seller />
            <Select
              label="Payment Method"
              data={PAYMENT_METHOD_OPTIONS}
              value={method}
              onChange={(v) => {
                key.reset();
                setMethod((v as StockPaymentMethod | null) ?? null);
              }}
              clearable
              error={method === null}
              w={200}
              data-payment-method
            />
            <Button onClick={confirm} loading={saving} disabled={!cartIsValid(cart) || method === null} data-save>
              Save
            </Button>
          </Group>
        </Card>
      )}
      {cart.length === 0 && outcome === null && products.length === 0 && (
        <Text c="dimmed" size="sm" ta="center">
          {/* PENDING (Porter): not in the final UI */}
          No product found
        </Text>
      )}
    </div>
  );
}

/** The route's page body: loads the products and the sellers, and sells through the fixture seam (until TASK-909 deploys). */
export default function StockOutSell() {
  const role = useRole();
  const products = useStockProducts(role);
  const sellers = useSellers(role);
  const sell = useSellStockOut(role);
  if (products.isError) return <ErrorState error={products.error} onRetry={() => products.refetch()} />;
  if (!role || !products.data || !sellers.data) return <LoadingState />;
  return <StockOutSellBody products={products.data} sellers={sellers.data} role={role} onSell={(req) => sell.mutateAsync(req)} />;
}
