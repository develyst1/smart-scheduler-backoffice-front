"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Card, Grid, Group, NumberInput, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { AlertTriangle, Check } from "lucide-react";
import StockProductPicker from "./StockProductPicker";
import { useReceiveStock, useStockProducts } from "./StockData";
import { balanceAfter, buildReceiveRequest, isReceivable, parseReceiveQty, validateReceive, type ReceiveDraft, type ReceiveErrors } from "./stock-in-logic";
import { createKeyKeeper, todayBkk } from "./stock-out-logic";
import { productLabel } from "./stock-picker-logic";
import { useRole } from "@/context/RoleContext";
import { ErrorState, LoadingState } from "@/components/partials/Salary/parts";
import { PageTitle } from "@/components/partials/Salary/PeopleParts";
import type { StockInRequest, StockInResult, StockProduct } from "@/types/app/stock";

type Outcome = { kind: "received"; result: StockInResult; name: string; qty: number } | { kind: "error"; message: string };

/**
 * TASK-912 — STOCK IN (REQ-120 R3.2): a delivery arrived, add N to stock. Product (the 905 picker, sold-out products included) + Quantity (a whole number above 0) + Date (default today, Bangkok; not in the future).
 * 🚫 NO cost, NO price, NO profit — those fields do not exist here. «Now in stock» shows the balance after this receive. Save sends ONE `POST /v1/stock/in` with one idempotency key per confirmed receive;
 * a double press reuses it, so it cannot add twice. A receive only raises a balance, so there is no negative case. CEO + Admin.
 */
export function StockInReceiveBody({
  products,
  onReceive,
  newKey = () => crypto.randomUUID(),
  today = todayBkk(),
  initial,
}: {
  products: StockProduct[];
  onReceive: (req: StockInRequest) => Promise<StockInResult>;
  newKey?: () => string;
  today?: string;
  /** a draft to start with — the tests render a filled form with this */
  initial?: Partial<ReceiveDraft>;
}) {
  const [product, setProduct] = useState<StockProduct | null>(initial?.product ?? null);
  const [qty, setQty] = useState<string>(initial?.qty ?? "");
  const [date, setDate] = useState<string | null>(initial?.receivedOn ?? today);
  const [errors, setErrors] = useState<ReceiveErrors>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saving, setSaving] = useState(false);
  const key = useMemo(() => createKeyKeeper(newKey), []); // eslint-disable-line react-hooks/exhaustive-deps
  // the balance shown is the LIVE one (the list re-reads after a receive), not the snapshot picked
  const live = product ? (products.find((p) => p.id === product.id) ?? product) : null;

  const edit = () => {
    key.reset(); // any edit makes it a different receive
    setOutcome(null);
  };

  const save = async () => {
    if (saving) return;
    const r = validateReceive({ product, qty, receivedOn: date }, today);
    if ("errors" in r) return setErrors(r.errors);
    setErrors({});
    setSaving(true);
    try {
      const result = await onReceive(buildReceiveRequest(r.ok, key.get()));
      setOutcome({ kind: "received", result, name: (product as StockProduct).name, qty: r.ok.qty });
      setProduct(null);
      setQty("");
      key.reset();
    } catch (e) {
      setOutcome({ kind: "error", message: e instanceof Error ? e.message : "—" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageTitle title="STOCK IN" />
      {outcome?.kind === "received" && (
        <Alert color="green" icon={<Check size={16} />} variant="light" data-received>
          {outcome.result.receiptId} · {outcome.name} +{outcome.qty}
        </Alert>
      )}
      {outcome?.kind === "error" && (
        <Alert color="red" icon={<AlertTriangle size={16} />} variant="light" data-receive-error>
          {outcome.message}
        </Alert>
      )}
      <Card padding="md">
        <Grid gap="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <StockProductPicker
              products={products}
              pickable={isReceivable}
              onAdd={(p) => {
                setProduct(p);
                edit();
              }}
              selectProps={{ value: product?.id ?? null, error: errors.product, label: "Product", placeholder: product ? productLabel(product) : undefined }}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <NumberInput
              label="Quantity"
              value={qty}
              onChange={(v) => {
                setQty(String(v));
                edit();
              }}
              min={1}
              allowDecimal={false}
              allowNegative={false}
              error={errors.qty}
              data-qty
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <DatePickerInput
              label="Date"
              value={date}
              onChange={(v) => {
                setDate(v);
                edit();
              }}
              maxDate={today}
              valueFormat="DD/MM/YY"
              error={errors.date}
              data-date
            />
          </Grid.Col>
        </Grid>
        <Group justify="space-between" mt="md" wrap="wrap">
          <Text size="sm" c="dimmed" data-now-in-stock>
            Now in stock: {live ? balanceAfter(live, qty) : "—"}
          </Text>
          <Button onClick={save} loading={saving} disabled={parseReceiveQty(qty) === null || !product} data-save>
            Save
          </Button>
        </Group>
      </Card>
    </div>
  );
}

/** The route's page body: loads the products (sold-out and active), and receives through the fixture seam (until the BE stock-in write deploys). */
export default function StockInReceive() {
  const role = useRole();
  const products = useStockProducts(role);
  const receive = useReceiveStock(role);
  if (products.isError) return <ErrorState error={products.error} onRetry={() => products.refetch()} />;
  if (!role || !products.data) return <LoadingState />;
  return <StockInReceiveBody products={products.data} onReceive={(req) => receive.mutateAsync(req)} />;
}
