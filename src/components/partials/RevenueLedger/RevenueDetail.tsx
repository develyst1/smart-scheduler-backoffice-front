"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import { Badge, Button, Card, Group, Select, Stack, Table, Text } from "@mantine/core";
import { DatePickerInput, MonthPickerInput } from "@mantine/dates";
import { Plus, Receipt } from "lucide-react";
import { useRevenueCategories, useRevenueLines } from "./hooks";
import { BRANCH_LABEL, METHOD_LABEL, TYPE_LABEL, TypeBadge, fmtDate, money, todayBangkok } from "./labels";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "./parts";
import {
  REVENUE_TYPES,
  type RevenueBranch,
  type RevenueLineType,
} from "@/types/app/revenue-ledger";

type Period = "DAY" | "MONTH" | "CUSTOM";
interface Filters {
  branch: "ALL" | RevenueBranch;
  period: Period;
  day: string;
  month: string; // YYYY-MM-01
  from: string;
  to: string;
  type: "ALL" | RevenueLineType;
  categoryId: string | null;
}

const MAX_DAYS = 366; // SPEC-098 §3: `from`..`to` inclusive, at most 366 days apart
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALL_TYPES = [...REVENUE_TYPES, "REFUND"] as const;

const BRANCH_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "BRAVO", label: BRANCH_LABEL.BRAVO },
  { value: "OTHER", label: BRANCH_LABEL.OTHER },
];
const PERIOD_OPTIONS = [
  { value: "DAY", label: "Day" },
  { value: "MONTH", label: "Month" },
  { value: "CUSTOM", label: "Custom" },
];
const TYPE_OPTIONS = [{ value: "ALL", label: "All" }, ...ALL_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))];

function rangeOf(f: Filters): { from: string; to: string } {
  if (f.period === "DAY") return { from: f.day, to: f.day };
  if (f.period === "MONTH") {
    return { from: dayjs(f.month).startOf("month").format("YYYY-MM-DD"), to: dayjs(f.month).endOf("month").format("YYYY-MM-DD") };
  }
  return { from: f.from, to: f.to };
}

/** Why a range cannot be sent, or null. Checked before Apply so the API never has to refuse it. */
function rangeProblem(f: Filters): string | null {
  const { from, to } = rangeOf(f);
  if (!from || !to) return "Pick both dates";
  if (from > to) return "“From” must not be after “To”";
  if (dayjs(to).diff(dayjs(from), "day") > MAX_DAYS) return "Pick a period of at most 366 days";
  return null;
}

/** Detail: every revenue line behind the summary (TASK-859 §4). Total is the API's `totalMinor`. */
export default function RevenueDetail() {
  const params = useSearchParams();
  const start = useMemo<Filters>(() => {
    const today = todayBangkok();
    const from = params.get("from");
    const to = params.get("to");
    const type = params.get("type");
    const branch = params.get("branch");
    const hasRange = from !== null && to !== null && DATE_RE.test(from) && DATE_RE.test(to);
    return {
      branch: branch === "BRAVO" || branch === "OTHER" ? branch : "ALL",
      period: hasRange ? (from === to ? "DAY" : "CUSTOM") : "DAY",
      day: hasRange && from === to ? from : today,
      month: dayjs(today).startOf("month").format("YYYY-MM-DD"),
      from: hasRange ? from : dayjs(today).subtract(2, "day").format("YYYY-MM-DD"),
      to: hasRange ? to : today,
      type: type !== null && (ALL_TYPES as readonly string[]).includes(type) ? (type as RevenueLineType) : "ALL",
      categoryId: null,
    };
    // The URL seeds the first render only; after that the filters are the page's own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [draft, setDraft] = useState<Filters>(start);
  const [applied, setApplied] = useState<Filters>(start);
  const [problem, setProblem] = useState<string | null>(null);

  const range = rangeOf(applied);
  const query = useRevenueLines({
    ...range,
    branch: applied.branch === "ALL" ? undefined : applied.branch,
    type: applied.type === "ALL" ? undefined : applied.type,
    categoryId: applied.categoryId ?? undefined,
  });

  // Category choices follow the Type filter. A refund has no category.
  const cats = useRevenueCategories(undefined, draft.type !== "REFUND");
  const catOptions = useMemo(() => {
    const all = cats.data ?? [];
    return REVENUE_TYPES.filter((t) => draft.type === "ALL" || draft.type === t)
      .map((t) => ({
        group: TYPE_LABEL[t],
        items: all.filter((c) => c.type === t).map((c) => ({ value: c.id, label: c.name })),
      }))
      .filter((g) => g.items.length > 0);
  }, [cats.data, draft.type]);

  const apply = () => {
    const p = rangeProblem(draft);
    setProblem(p);
    if (!p) setApplied(draft);
  };

  const periodLabel =
    applied.period === "DAY"
      ? fmtDate(applied.day)
      : applied.period === "MONTH"
        ? dayjs(applied.month).format("MM/YY")
        : `${fmtDate(applied.from)}–${fmtDate(applied.to)}`;

  const data = query.data;
  // Both money figures come from the API (SPEC-098 §3); the screen only counts rows.
  const revenueCount = data?.lines.filter((l) => l.type !== "REFUND").length ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Detail"
        actions={[
          { href: "/revenue/summary", label: "Summary", icon: <Receipt size={16} /> },
          { href: "/revenue/manual", label: "Add Manually", icon: <Plus size={16} />, primary: true },
        ]}
      />
      <Stack gap="md">
        <Card>
          <Group align="flex-end" wrap="wrap" gap="sm">
            <Select
              label="Branch"
              data={BRANCH_OPTIONS}
              value={draft.branch}
              onChange={(v) => setDraft({ ...draft, branch: (v as Filters["branch"]) ?? "ALL" })}
              w={130}
              allowDeselect={false}
            />
            <Select
              label="Period"
              data={PERIOD_OPTIONS}
              value={draft.period}
              onChange={(v) => setDraft({ ...draft, period: (v as Period) ?? "DAY" })}
              w={130}
              allowDeselect={false}
            />
            {draft.period === "DAY" && (
              <DatePickerInput
                label="Date"
                value={draft.day}
                onChange={(v) => v && setDraft({ ...draft, day: v })}
                valueFormat="DD/MM/YY"
                w={150}
              />
            )}
            {draft.period === "MONTH" && (
              <MonthPickerInput
                label="Month"
                value={draft.month}
                onChange={(v) => v && setDraft({ ...draft, month: v })}
                valueFormat="MM/YY"
                w={130}
              />
            )}
            {draft.period === "CUSTOM" && (
              <>
                <DatePickerInput
                  label="From"
                  value={draft.from}
                  onChange={(v) => v && setDraft({ ...draft, from: v })}
                  valueFormat="DD/MM/YY"
                  w={150}
                />
                <DatePickerInput
                  label="To"
                  value={draft.to}
                  onChange={(v) => v && setDraft({ ...draft, to: v })}
                  valueFormat="DD/MM/YY"
                  w={150}
                />
              </>
            )}
            <Select
              label="Type"
              data={TYPE_OPTIONS}
              value={draft.type}
              onChange={(v) => setDraft({ ...draft, type: (v as Filters["type"]) ?? "ALL", categoryId: null })}
              w={150}
              allowDeselect={false}
            />
            <Select
              label="Category"
              placeholder="All"
              data={catOptions}
              value={draft.categoryId}
              onChange={(v) => setDraft({ ...draft, categoryId: v })}
              disabled={draft.type === "REFUND"}
              clearable
              searchable
              w={240}
            />
            <Button onClick={apply}>Apply filters</Button>
          </Group>
          {problem && (
            <Text c="red.7" size="sm" mt="xs" role="alert">
              {problem}
            </Text>
          )}
        </Card>

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !data ? (
          <LoadingState />
        ) : (
          <Card>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>{periodLabel}</Text>
              <Badge variant="light" color="gray">
                {data.lines.length} items
              </Badge>
            </Group>
            {data.lines.length === 0 ? (
              <EmptyState>No revenue in this period</EmptyState>
            ) : (
              <Table.ScrollContainer minWidth={760}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Branch</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Product Name</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                      <Table.Th>Payment</Table.Th>
                      <Table.Th>Remark</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.lines.map((l) => {
                      const expense = l.type === "REFUND";
                      return (
                        <Table.Tr key={l.id} bg={expense ? "var(--mantine-color-red-light)" : undefined}>
                          <Table.Td>{fmtDate(l.occurredOn)}</Table.Td>
                          <Table.Td>{BRANCH_LABEL[l.branch]}</Table.Td>
                          <Table.Td>
                            <TypeBadge type={l.type} />
                          </Table.Td>
                          <Table.Td>{l.categoryName ?? "—"}</Table.Td>
                          <Table.Td>
                            {l.productName}
                            {expense && (
                              <Badge ml={6} size="sm" color="red" variant="light">
                                expense
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td ta="right" c={expense ? "red.7" : undefined} className="font-num whitespace-nowrap">
                            {money(l.amountMinor)}
                          </Table.Td>
                          <Table.Td>{METHOD_LABEL[l.method]}</Table.Td>
                          <Table.Td c="dimmed" fz="sm">
                            {/* Long remarks wrap inside a width-capped column instead of widening the table. */}
                            <div className="min-w-[160px] max-w-[260px]">{l.remark ?? ""}</div>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                    <Table.Tr>
                      <Table.Td colSpan={5} fw={700}>
                        Total Revenue ({revenueCount} items)
                      </Table.Td>
                      <Table.Td ta="right" fw={700} className="font-num whitespace-nowrap">
                        {money(data.revenueMinor)}
                      </Table.Td>
                      <Table.Td colSpan={2} />
                    </Table.Tr>
                    {data.refundsMinor !== 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5}>Refund (Expense)</Table.Td>
                        <Table.Td ta="right" c={data.refundsMinor < 0 ? "red.7" : undefined} className="font-num whitespace-nowrap">
                          {money(data.refundsMinor)}
                        </Table.Td>
                        <Table.Td colSpan={2} />
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Card>
        )}
      </Stack>
    </div>
  );
}
