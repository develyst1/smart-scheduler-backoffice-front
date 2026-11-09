"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Group, SegmentedControl, Select, Table, Tabs, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useStockBalances, useStockMovements, useStockSales } from "./StockReportData";
import { ALL_CUSTOMERS, customerLabel, customerOptions, paymentWord } from "./sales-logic";
import { MAX_PERIOD_DAYS, periodOf, periodProblem, type Period, type PeriodPreset } from "./period";
import { useRole } from "@/context/RoleContext";
import { stockReportIsSample } from "@/services/stock-report.service";
import { EmptyState, ErrorState, LoadingState } from "@/components/partials/RevenueLedger/parts";
import { fmtDate, todayBangkok } from "@/components/partials/RevenueLedger/labels";
import { STOCK_MOVEMENT_TYPES, type StockBalanceRow, type StockMovementRow, type StockMovementType, type StockReportTab, type StockSaleRow } from "@/types/app/stock-report";

export const MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = { SALE: "Sale", STOCK_IN: "Stock in", ADJUSTMENT: "Adjustment", FROM_DEMO: "From Demo" };
const TYPE_OPTIONS = [{ value: "ALL", label: "All" }, ...STOCK_MOVEMENT_TYPES.map((t) => ({ value: t, label: MOVEMENT_TYPE_LABEL[t] }))];
const PRESET_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "custom", label: "Custom" },
];

/** The Movement list: Date · Type · Product · Qty (+n green / −n red). No amounts — the final UI says so. */
export function MovementTable({ rows }: { rows: StockMovementRow[] }) {
  if (rows.length === 0) return <EmptyState>No movement in this period</EmptyState>;
  return (
    <Table.ScrollContainer minWidth={480}>
      <Table verticalSpacing="xs" horizontalSpacing="md" data-movement-table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>DATE</Table.Th>
            <Table.Th>TYPE</Table.Th>
            <Table.Th>PRODUCT</Table.Th>
            <Table.Th ta="right">QTY</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id} data-movement-row={r.id}>
              <Table.Td className="tabular-nums">{fmtDate(r.occurredOn)}</Table.Td>
              <Table.Td>
                <Badge variant="light" color={r.type === "SALE" ? "red" : "teal"}>
                  {MOVEMENT_TYPE_LABEL[r.type]}
                </Badge>
              </Table.Td>
              <Table.Td fw={600}>{r.itemName}</Table.Td>
              <Table.Td ta="right" className="tabular-nums" c={r.qty < 0 ? "red" : "teal"} data-qty={r.qty}>
                {r.qty > 0 ? `+${r.qty}` : `−${Math.abs(r.qty)}`}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** TASK-929 — Sales History: Date · Product · Qty · Customer · Payment. No money (the final UI says so); a sale with no buyer reads "Walk-in". */
export function SalesTable({ rows }: { rows: StockSaleRow[] }) {
  if (rows.length === 0) return <EmptyState>No sales in this period</EmptyState>;
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="xs" horizontalSpacing="md" data-sales-table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>DATE</Table.Th>
            <Table.Th>PRODUCT</Table.Th>
            <Table.Th ta="right">QTY</Table.Th>
            <Table.Th>CUSTOMER</Table.Th>
            <Table.Th>PAYMENT</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id} data-sale-row={r.id}>
              <Table.Td className="tabular-nums">{fmtDate(r.occurredOn)}</Table.Td>
              <Table.Td fw={600}>{r.name}</Table.Td>
              <Table.Td ta="right" className="tabular-nums">
                {r.qty}
              </Table.Td>
              <Table.Td data-customer={r.customer === null ? "walk-in" : "named"}>{customerLabel(r.customer)}</Table.Td>
              <Table.Td>{paymentWord(r.payment)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** TASK-929 — Balance: Product · Balance (the current quantity on hand). One location, so no Location column; no From/To. */
export function BalanceTable({ rows }: { rows: StockBalanceRow[] }) {
  if (rows.length === 0) return <EmptyState>No products yet</EmptyState>;
  return (
    <Table.ScrollContainer minWidth={420}>
      <Table verticalSpacing="xs" horizontalSpacing="md" data-balance-table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>PRODUCT</Table.Th>
            <Table.Th ta="right">BALANCE</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id} data-balance-row={r.id}>
              <Table.Td fw={600}>{r.name}</Table.Td>
              <Table.Td ta="right" className="tabular-nums" data-balance={r.quantity}>
                {r.quantity}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/**
 * TASK-906 — the Stock Report shell: header, the period filter (Day / Month / Custom over two inclusive dates), the three report tabs (Movement; TASK-929 adds Sales History
 * and Balance), all on the fixture seam, with a "Sample data" notice while they are. Routed at `/stock/reports` (CEO + Admin, Sober's Q3). Export is out of scope (Q5).
 */
export default function StockReport() {
  const role = useRole();
  const today = todayBangkok();
  const [tab, setTab] = useState<StockReportTab>("movement");
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [period, setPeriod] = useState<Period>(() => periodOf("month", today));
  const [type, setType] = useState<"ALL" | StockMovementType>("ALL");

  const problem = periodProblem(period);
  const q = useStockMovements(role, { from: period.from, to: period.to, type: type === "ALL" ? undefined : type }, tab === "movement" && problem === null);
  // TASK-929: a Customer choice belongs to one window's buyers, so a new period puts it back to "All".
  const [customer, setCustomer] = useState<string>(ALL_CUSTOMERS);
  useEffect(() => setCustomer(ALL_CUSTOMERS), [period.from, period.to]);
  const sales = useStockSales(role, { from: period.from, to: period.to, customer: customer === ALL_CUSTOMERS ? undefined : customer }, tab === "sales" && problem === null);
  const balance = useStockBalances(role, tab === "balance");

  const pick = (p: PeriodPreset) => {
    setPreset(p);
    if (p !== "custom") setPeriod(periodOf(p, period.to <= today ? period.to : today));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Stock Report</h1>
      {stockReportIsSample() && (
        <Alert color="yellow" variant="light" data-sample-notice>
          Sample data — the live stock movements are connected with TASK-904.
        </Alert>
      )}
      <Card padding="md" data-period-filter>
        <Group align="flex-end" gap="sm" wrap="wrap">
          <SegmentedControl
            data={PRESET_OPTIONS}
            value={preset}
            onChange={(v) => pick(v as PeriodPreset)}
            aria-label="Period"
          />
          {preset === "day" ? (
            <DatePickerInput label="Day" value={period.from} onChange={(v) => v && setPeriod(periodOf("day", v))} valueFormat="DD/MM/YY" w={150} />
          ) : preset === "month" ? (
            <DatePickerInput
              label="Month"
              value={period.from}
              onChange={(v) => v && setPeriod(periodOf("month", v))}
              valueFormat="MMM YYYY"
              w={150}
            />
          ) : (
            <>
              <DatePickerInput label="From" value={period.from} onChange={(v) => v && setPeriod({ ...period, from: v })} valueFormat="DD/MM/YY" w={150} />
              <DatePickerInput label="To" value={period.to} onChange={(v) => v && setPeriod({ ...period, to: v })} valueFormat="DD/MM/YY" w={150} />
            </>
          )}
          <Text size="sm" c="dimmed" data-period-caption>
            {fmtDate(period.from)} – {fmtDate(period.to)}
          </Text>
        </Group>
        {problem && (
          <Text c="red" size="sm" mt="xs" role="alert" data-period-problem>
            {problem}
          </Text>
        )}
      </Card>

      <Tabs value={tab} onChange={(v) => setTab((v ?? "movement") as StockReportTab)} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="sales">Sales History</Tabs.Tab>
          <Tabs.Tab value="balance">Balance</Tabs.Tab>
          <Tabs.Tab value="movement">Movement</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="sales" pt="md">
          <Card padding={0}>
            <Group p="md" gap="sm" align="flex-end">
              <Select
                label="Customer"
                data={customerOptions(sales.data?.customers ?? [])}
                value={customer}
                onChange={(v) => setCustomer(v ?? ALL_CUSTOMERS)}
                allowDeselect={false}
                w={200}
                data-customer-select
              />
            </Group>
            {problem ? null : sales.isError ? (
              <ErrorState error={sales.error} onRetry={() => sales.refetch()} />
            ) : !role || !sales.data ? (
              <LoadingState />
            ) : (
              <SalesTable rows={sales.data.items} />
            )}
          </Card>
          <Text size="xs" c="dimmed" mt="xs">
            A period is at most {MAX_PERIOD_DAYS} days; both ends are included.
          </Text>
        </Tabs.Panel>
        <Tabs.Panel value="balance" pt="md">
          <Card padding={0}>
            <Text size="sm" c="dimmed" p="md" data-balance-note>
              The quantity on hand now — the period above does not change it.
            </Text>
            {balance.isError ? <ErrorState error={balance.error} onRetry={() => balance.refetch()} /> : !role || !balance.data ? <LoadingState /> : <BalanceTable rows={balance.data} />}
          </Card>
        </Tabs.Panel>
        <Tabs.Panel value="movement" pt="md">
          <Card padding={0}>
            <Group p="md" gap="sm" align="flex-end">
              <Select label="Type" data={TYPE_OPTIONS} value={type} onChange={(v) => setType((v ?? "ALL") as "ALL" | StockMovementType)} allowDeselect={false} w={160} />
              {problem && (
                <Button
                  variant="default"
                  onClick={() => {
                    setPreset("month");
                    setPeriod(periodOf("month", today));
                  }}
                >
                  Reset to this month
                </Button>
              )}
            </Group>
            {problem ? null : q.isError ? (
              <ErrorState error={q.error} onRetry={() => q.refetch()} />
            ) : !role || !q.data ? (
              <LoadingState />
            ) : (
              <MovementTable rows={q.data} />
            )}
          </Card>
          <Text size="xs" c="dimmed" mt="xs">
            A period is at most {MAX_PERIOD_DAYS} days; both ends are included.
          </Text>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
