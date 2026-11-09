"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { Card, Group, Select, SimpleGrid, Text } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { useOverview } from "./hooks";
import { BRANCH_OPTIONS } from "./labels";
import { EmptyState, ErrorState, LoadingState } from "@/components/partials/RevenueLedger/parts";
import { money, todayBangkok } from "@/components/partials/RevenueLedger/labels";
import type { ReportBranch, ReportOverview } from "@/types/app/reports";

/** The cards, in SPEC-103 §4 order. A money card exists only when the API sent it (a CEO's answer): for an admin it is absent, never hidden, never 0. */
export function overviewCards(o: ReportOverview): { key: string; label: string; value: number; text: string }[] {
  const n = (key: string, label: string, value: number) => ({ key, label, value, text: value.toLocaleString("en-US") });
  const cards = [
    n("newStudents", "New students", o.newStudents),
    n("activeStudents", "Active students", o.activeStudents),
    n("trialsBooked", "Trials booked", o.trialsBooked),
    n("trials", "Trials attended", o.trials),
    n("trialsConverted", "Converted", o.trialsConverted),
    n("coursesSold", "Courses sold", o.coursesSold),
    n("vouchersSold", "Vouchers sold", o.vouchersSold),
    n("sessionsTaught", "Sessions taught", o.sessionsTaught),
  ];
  if (o.revenueMinor !== undefined) cards.push({ key: "revenueMinor", label: "Revenue", value: o.revenueMinor, text: money(o.revenueMinor) });
  if (o.refundsMinor !== undefined) cards.push({ key: "refundsMinor", label: "Refunds", value: o.refundsMinor, text: money(o.refundsMinor) });
  return cards;
}

/** This month beside the previous month, card by card — no chart. */
export function OverviewCards({ current, previous }: { current: ReportOverview; previous: ReportOverview | undefined }) {
  const prev = previous ? new Map(overviewCards(previous).map((c) => [c.key, c.text])) : new Map<string, string>();
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="sm" data-overview-cards>
      {overviewCards(current).map((c) => (
        <Card key={c.key} padding="md" data-card={c.key}>
          <Text size="xs" c="dimmed" tt="uppercase">
            {c.label}
          </Text>
          <Text fz={28} fw={600} className="tabular-nums" data-card-value>
            {c.text}
          </Text>
          <Text size="xs" c="dimmed" data-card-prev>
            Previous month: {prev.get(c.key) ?? "—"}
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

/** REPORT — a month picker (this month by default) + the branch filter (SPEC-103 §4). */
export default function ReportTab() {
  const [month, setMonth] = useState(todayBangkok().slice(0, 7));
  const [branch, setBranch] = useState<"ALL" | ReportBranch>("ALL");
  const b = branch === "ALL" ? undefined : branch;
  const prevMonth = dayjs(`${month}-01`).subtract(1, "month").format("YYYY-MM");
  const cur = useOverview({ month, branch: b });
  const prev = useOverview({ month: prevMonth, branch: b });

  return (
    <div className="space-y-4">
      <Card padding="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <MonthPickerInput locale="en" label="Month" value={`${month}-01`} onChange={(v) => v && setMonth(dayjs(v).format("YYYY-MM"))} valueFormat="MMM YYYY" maxDate={todayBangkok()} w={160} />
          <Select label="Branch" data={BRANCH_OPTIONS} value={branch} onChange={(v) => setBranch((v ?? "ALL") as "ALL" | ReportBranch)} allowDeselect={false} w={140} />
        </Group>
      </Card>
      {cur.isError ? (
        <ErrorState error={cur.error} onRetry={() => cur.refetch()} />
      ) : !cur.data ? (
        <LoadingState />
      ) : overviewCards(cur.data).every((c) => c.value === 0) ? (
        <Card padding={0}>
          <EmptyState>No data for this period</EmptyState>
        </Card>
      ) : (
        <>
          {b !== undefined && (
            <Text size="sm" c="dimmed" data-students-all-branches>
              Students: all branches (a student has no branch; the other numbers follow the branch).
            </Text>
          )}
          <OverviewCards current={cur.data} previous={prev.data} />
        </>
      )}
    </div>
  );
}
