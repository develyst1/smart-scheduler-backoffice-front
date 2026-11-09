"use client";

import { useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { Badge, Button, Card, Group, Select, Stack, Table, Tabs, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { FileText, GraduationCap, Plus, Undo2 } from "lucide-react";
import { useRevenueSummary } from "./hooks";
import { BRANCH_LABEL, TYPE_LABEL, TypeBadge, fmtDate, money, todayBangkok } from "./labels";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "./parts";
import { REVENUE_TYPES, type RevenueBranch, type RevenueType } from "@/types/app/revenue-ledger";

type Tab = "today" | "mtd" | "ytd";
interface Filters {
  branch: "ALL" | RevenueBranch;
  date: string;
  type: "ALL" | RevenueType;
}

const BRANCH_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "BRAVO", label: BRANCH_LABEL.BRAVO },
  { value: "OTHER", label: BRANCH_LABEL.OTHER },
];
const TYPE_OPTIONS = [
  { value: "ALL", label: "All" },
  ...REVENUE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
];

/** The range each tab covers, from the picked date (SPEC-098 §3 `/summary`). */
function rangeOf(tab: Tab, date: string): { from: string; to: string } {
  if (tab === "today") return { from: date, to: date };
  if (tab === "mtd") return { from: dayjs(date).startOf("month").format("YYYY-MM-DD"), to: date };
  return { from: dayjs(date).startOf("year").format("YYYY-MM-DD"), to: date };
}

/** Revenue Summary: by type, Today / MTD / YTD (TASK-859 §3). Every figure is the API's; the only sum is the filtered rows. */
export default function RevenueSummary() {
  const start: Filters = { branch: "ALL", date: todayBangkok(), type: "ALL" };
  const [draft, setDraft] = useState<Filters>(start);
  const [applied, setApplied] = useState<Filters>(start);
  const [tab, setTab] = useState<Tab>("today");

  const query = useRevenueSummary({
    date: applied.date,
    branch: applied.branch === "ALL" ? undefined : applied.branch,
  });

  const range = rangeOf(tab, applied.date);
  const caption =
    tab === "today"
      ? `Today ${fmtDate(applied.date)}`
      : `${tab === "mtd" ? "MTD" : "YTD"} ${fmtDate(range.from)}–${fmtDate(range.to)}`;

  const block = query.data?.[tab];
  const rows = block?.rows.filter((r) => applied.type === "ALL" || r.type === applied.type) ?? [];
  const filtered = block !== undefined && rows.length !== block.rows.length;
  const allZero = block !== undefined && block.rows.every((r) => r.amountMinor === 0) && block.refundsMinor === 0;
  const rowsTotal = rows.reduce((s, r) => s + r.amountMinor, 0);

  const detailHref = (type?: RevenueType) => {
    const q = new URLSearchParams({ from: range.from, to: range.to });
    if (type) q.set("type", type);
    if (applied.branch !== "ALL") q.set("branch", applied.branch);
    return `/revenue/detail?${q.toString()}`;
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Summary"
        actions={[
          { href: "/revenue/detail", label: "Detail", icon: <FileText size={16} /> },
          { href: "/revenue/refund", label: "Refund", icon: <Undo2 size={16} /> },
          { href: "/revenue/eca", label: "ECA Payment", icon: <GraduationCap size={16} /> },
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
            <DatePickerInput
              label="Date"
              value={draft.date}
              onChange={(v) => v && setDraft({ ...draft, date: v })}
              valueFormat="DD/MM/YY"
              w={150}
            />
            <Select
              label="Type"
              data={TYPE_OPTIONS}
              value={draft.type}
              onChange={(v) => setDraft({ ...draft, type: (v as Filters["type"]) ?? "ALL" })}
              w={150}
              allowDeselect={false}
            />
            <Button onClick={() => setApplied(draft)}>Apply filters</Button>
          </Group>
        </Card>

        <Tabs value={tab} onChange={(v) => setTab((v as Tab) ?? "today")}>
          <Tabs.List>
            <Tabs.Tab value="today">Today</Tabs.Tab>
            <Tabs.Tab value="mtd">MTD</Tabs.Tab>
            <Tabs.Tab value="ytd">YTD</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : !block ? (
          <LoadingState />
        ) : (
          <Card>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>{caption}</Text>
              <Badge variant="light" color="gray">
                {applied.branch === "ALL" ? "Bravo + Other" : BRANCH_LABEL[applied.branch]}
              </Badge>
            </Group>
            {allZero ? (
              <EmptyState>No revenue in this period</EmptyState>
            ) : (
              <Table.ScrollContainer minWidth={360}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Type</Table.Th>
                      <Table.Th ta="right">Revenue</Table.Th>
                      <Table.Th w={90} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((r) => (
                      <Table.Tr key={r.type}>
                        <Table.Td>
                          <TypeBadge type={r.type} />
                        </Table.Td>
                        <Table.Td ta="right" className="font-num whitespace-nowrap">
                          {money(r.amountMinor)}
                        </Table.Td>
                        <Table.Td ta="right">
                          <Button component={Link} href={detailHref(r.type)} size="compact-sm" variant="subtle">
                            View
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    <Table.Tr>
                      <Table.Td fw={700}>Total Revenue</Table.Td>
                      <Table.Td ta="right" fw={700} className="font-num">
                        {money(filtered ? rowsTotal : block.totalMinor)}
                      </Table.Td>
                      <Table.Td />
                    </Table.Tr>
                    {!filtered && (
                      <Table.Tr>
                        <Table.Td>Refund (Expense)</Table.Td>
                        <Table.Td ta="right" c={block.refundsMinor < 0 ? "red.7" : undefined} className="font-num">
                          {money(block.refundsMinor)}
                        </Table.Td>
                        <Table.Td />
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
