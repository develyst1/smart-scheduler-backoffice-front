"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { Card, Group, Select, Table, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useCourses } from "./hooks";
import { BRANCH_OPTIONS, KIND_LABEL } from "./labels";
import { EmptyState, ErrorState, LoadingState } from "@/components/partials/RevenueLedger/parts";
import { fmtDate, money, todayBangkok } from "@/components/partials/RevenueLedger/labels";
import type { CoursesResult, ReportBranch } from "@/types/app/reports";

const MAX_DAYS = 366;

/** The table: Activity · Kind · Size · Sold · Active · Paused · Ended · Sessions taught · [Revenue]. The Revenue column exists only when the API sent revenue (CEO). */
export function CourseTable({ data }: { data: CoursesResult }) {
  if (data.rows.length === 0) return <EmptyState>No data for this period</EmptyState>;
  const hasRevenue = data.totals.revenueMinor !== undefined;
  const unmatched = data.totals.unmatchedRevenueMinor;
  return (
    <>
      {data.activeIsApprox && (
        <Text size="sm" c="dimmed" px="md" pt="md" data-active-approx>
          Active uses today&apos;s sessions left.
        </Text>
      )}
      <Table.ScrollContainer minWidth={760}>
        <Table verticalSpacing="xs" horizontalSpacing="md" data-course-table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ACTIVITY</Table.Th>
              <Table.Th>KIND</Table.Th>
              <Table.Th ta="right">SIZE</Table.Th>
              <Table.Th ta="right">SOLD</Table.Th>
              <Table.Th ta="right">ACTIVE</Table.Th>
              <Table.Th ta="right">PAUSED</Table.Th>
              <Table.Th ta="right">ENDED</Table.Th>
              <Table.Th ta="right">SESSIONS TAUGHT</Table.Th>
              {hasRevenue && <Table.Th ta="right">REVENUE</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.rows.map((r) => (
              <Table.Tr key={`${r.subjectId ?? "voucher"}-${r.kind}-${r.size}`} data-course-row>
                <Table.Td fw={600}>{r.subjectId === null ? "Voucher" : r.subjectName}</Table.Td>
                <Table.Td>{KIND_LABEL[r.kind]}</Table.Td>
                <Table.Td ta="right" className="tabular-nums">
                  {r.size}
                </Table.Td>
                <Table.Td ta="right" className="tabular-nums">{r.sold}</Table.Td>
                <Table.Td ta="right" className="tabular-nums">{r.active}</Table.Td>
                <Table.Td ta="right" className="tabular-nums">{r.paused}</Table.Td>
                <Table.Td ta="right" className="tabular-nums">{r.ended}</Table.Td>
                <Table.Td ta="right" className="tabular-nums">{r.sessionsTaught}</Table.Td>
                {hasRevenue && (
                  <Table.Td ta="right" className="tabular-nums">
                    {r.revenueMinor === undefined ? "—" : money(r.revenueMinor)}
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr fw={700} data-course-totals>
              <Table.Td colSpan={3}>Total</Table.Td>
              <Table.Td ta="right" className="tabular-nums">{data.totals.sold}</Table.Td>
              <Table.Td ta="right" className="tabular-nums">{data.totals.active}</Table.Td>
              <Table.Td ta="right" className="tabular-nums">{data.totals.paused}</Table.Td>
              <Table.Td ta="right" className="tabular-nums">{data.totals.ended}</Table.Td>
              <Table.Td ta="right" className="tabular-nums">{data.totals.sessionsTaught}</Table.Td>
              {hasRevenue && (
                <Table.Td ta="right" className="tabular-nums">
                  {money(data.totals.revenueMinor as number)}
                </Table.Td>
              )}
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Table.ScrollContainer>
      {unmatched !== undefined && unmatched !== 0 && (
        <Text size="sm" c="dimmed" p="md" data-unmatched-note>
          Revenue not matched to a course or voucher: {money(unmatched)} (not in the rows above).
        </Text>
      )}
    </>
  );
}

/** COURSE — a from / to picker (this month by default) + the branch filter (SPEC-103 §2). */
export default function CourseTab() {
  const today = todayBangkok();
  const [range, setRange] = useState({ from: dayjs(today).startOf("month").format("YYYY-MM-DD"), to: today });
  const [branch, setBranch] = useState<"ALL" | ReportBranch>("ALL");
  const problem = range.from > range.to ? "From must not be after To." : dayjs(range.to).diff(dayjs(range.from), "day") + 1 > MAX_DAYS ? `A period is at most ${MAX_DAYS} days.` : null;
  const q = useCourses({ from: range.from, to: range.to, branch: branch === "ALL" ? undefined : branch }, problem === null);

  return (
    <div className="space-y-4">
      <Card padding="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <DatePickerInput locale="en" label="From" value={range.from} onChange={(v) => v && setRange({ ...range, from: v })} valueFormat="DD/MM/YY" w={150} />
          <DatePickerInput locale="en" label="To" value={range.to} onChange={(v) => v && setRange({ ...range, to: v })} valueFormat="DD/MM/YY" w={150} />
          <Select label="Branch" data={BRANCH_OPTIONS} value={branch} onChange={(v) => setBranch((v ?? "ALL") as "ALL" | ReportBranch)} allowDeselect={false} w={140} />
          <Text size="sm" c="dimmed">
            {fmtDate(range.from)} – {fmtDate(range.to)}
          </Text>
        </Group>
        {problem && (
          <Text c="red" size="sm" mt="xs" role="alert" data-period-problem>
            {problem}
          </Text>
        )}
      </Card>
      <Card padding={0}>{problem ? null : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <LoadingState /> : <CourseTable data={q.data} />}</Card>
    </div>
  );
}
