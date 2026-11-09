"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Table, Tabs, Title } from "@mantine/core";
import { Download } from "lucide-react";
import { useDaily } from "./PeopleData";
import { PageTitle, baht } from "./PeopleParts";
import { fmtDate } from "./money";
import { ErrorState, LoadingState } from "./parts";
import { dailyTabDates } from "@/services/salary-people.service";
import { useRole } from "@/context/RoleContext";
import type { DailyDay } from "@/types/app/salary-people";

/** Today in Bangkok, YYYY-MM-DD. */
const todayBkk = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

/** SALARY › Daily Training Report (CEO): by TEACHING HOURS only (no check-in / check-out) + the number of coaches. Source: final-ui `salary/Daily.tsx`. */
export function DailyBody({
  dates,
  day,
  onDay,
  report,
  onBack,
}: {
  dates: string[];
  day: string;
  onDay: (date: string) => void;
  /** the open day's rows; undefined while it loads */
  report: DailyDay | null | undefined;
  onBack: () => void;
}) {
  const d = report ?? undefined;
  // hours are 2-decimal numbers from the server: sum in hundredths, so 1.25 + 0.75 never prints 1.9999999
  const hours = d ? d.rows.reduce((a, r) => a + Math.round(r.hours * 100), 0) / 100 : 0;
  const income = d?.rows.reduce((a, r) => a + (r.incomeSatang ?? 0), 0) ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Daily Training Report"
        actions={
          <>
            <Button variant="default" onClick={onBack}>
              Back to Monthly Payment
            </Button>
            {/* TODO(TASK-wiring): the real export. Until then it is a visible button that does nothing — never a fake download (TASK-862). */}
            <Button variant="default" leftSection={<Download size={16} />}>
              Export
            </Button>
          </>
        }
      />
      <Tabs value={day} onChange={(v) => v && onDay(v)} mb="md">
        <Tabs.List>
          {dates.map((x) => (
            <Tabs.Tab key={x} value={x}>
              {fmtDate(x)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      {report === undefined && <LoadingState />}
      {d && (
        <Card padding="md">
          <Title order={4} fz={16} fw={600} mb="md">
            {fmtDate(d.date)} ({d.weekday})
          </Title>
          <Table.ScrollContainer minWidth={600}>
            {/* REQ-5010: the spacing is balanced — fixed column shares, the numbers right-aligned in their own columns */}
            <Table verticalSpacing="sm" horizontalSpacing="lg" style={{ tableLayout: "fixed" }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w="18%">Coach</Table.Th>
                  <Table.Th w="18%">Role</Table.Th>
                  <Table.Th w="12%" ta="right">
                    Hour
                  </Table.Th>
                  <Table.Th w="32%">Description</Table.Th>
                  <Table.Th w="20%" ta="right">
                    Daily Income
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {d.rows.map((r) => (
                  <Table.Tr key={r.coach}>
                    <Table.Td fw={600}>{r.coach}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" tt="none">
                        {r.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right" className="tabular-nums">
                      {r.hours} Hr
                    </Table.Td>
                    <Table.Td>{r.description}</Table.Td>
                    <Table.Td ta="right" className="tabular-nums">
                      {r.incomeSatang === null ? "—" : baht(r.incomeSatang)}
                    </Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr>
                  <Table.Td colSpan={2} fw={700}>
                    Total · {d.rows.length} coaches
                  </Table.Td>
                  <Table.Td ta="right" fw={700} className="tabular-nums">
                    {hours} Hr
                  </Table.Td>
                  <Table.Td />
                  <Table.Td ta="right" fw={700} className="tabular-nums">
                    {baht(income)}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </div>
  );
}

export default function Daily() {
  const router = useRouter();
  const role = useRole();
  const dates = dailyTabDates(todayBkk());
  const [day, setDay] = useState(dates[dates.length - 1] ?? ""); // the newest day opens first
  const report = useDaily(day, role);
  if (report.isError) return <ErrorState error={report.error} onRetry={() => report.refetch()} />;
  if (!role) return <LoadingState />;
  return <DailyBody dates={dates} day={day} onDay={setDay} report={report.isSuccess ? report.data : undefined} onBack={() => router.push("/salary/payrun")} />;
}
