"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Center, Loader, Progress, Tabs, Text, TextInput, Badge } from "@mantine/core";
import { MonthPickerInput } from "@mantine/dates";
import { useDebouncedValue } from "@mantine/hooks";
import dayjs from "dayjs";
import { CalendarRange, PieChart, Search, Users, Info } from "lucide-react";
import { useCustomerSpend, useRevenueByActivity } from "@/hooks/backoffice/useBo";
import {
  thb,
  type CustomerSpend,
  type RevenueByActivity,
  type UnattributedCode,
} from "@/types/app/bo";

function Figure({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-num ${className}`}>{children}</span>;
}

/**
 * Revenue by activity + customer spend (SPEC-021 / TASK-065).
 *
 * ⚠️ The rule this screen exists to honour: **`unattributed` is always visible and always reconciles.**
 * A voucher is generic hours and has no sport at sale, so it cannot be attributed. Showing only the
 * attributable slice would render a tidy split that does not add up to the month's real revenue — and that
 * is the number an executive would act on. Percentages are therefore of `totalMinor`, never of the
 * attributed subset, which would quietly inflate every sport.
 *
 * No money is computed here. Percentages are display ratios of figures the API already reconciled.
 */
export default function RevenueContent() {
  const [month, setMonth] = useState<Date>(dayjs().startOf("month").toDate());
  const monthStr = dayjs(month).format("YYYY-MM");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-success/70">Revenue</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">รายได้แยกตามกิจกรรม</h1>
          <p className="mt-0.5 text-sm text-default-400">
            ยอดขายรายเดือน แยกตามกีฬา และยอดใช้จ่ายรายลูกค้า
          </p>
        </div>
        <MonthPickerInput
          value={month}
          onChange={(v) => v && setMonth(new Date(v))}
          valueFormat="MMMM YYYY"
          leftSection={<CalendarRange size={15} />}
          className="w-full sm:w-64"
          size="sm"
        />
      </div>

      <Tabs defaultValue="activity" color="green">
        <Tabs.List>
          <Tabs.Tab value="activity" leftSection={<PieChart size={15} />}>
            แยกตามกีฬา
          </Tabs.Tab>
          <Tabs.Tab value="customer" leftSection={<Users size={15} />}>
            รายลูกค้า
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="activity" pt="lg">
          <ActivityPanel month={monthStr} />
        </Tabs.Panel>
        <Tabs.Panel value="customer" pt="lg">
          <CustomerPanel month={monthStr} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function ActivityPanel({ month }: { month: string }) {
  const query = useRevenueByActivity(month);

  if (query.isLoading) return <Center h={240}><Loader color="green" /></Center>;
  if (query.isError)
    return (
      <Card padding="xl">
        <Text c="red" fw={500}>โหลดรายงานไม่สำเร็จ</Text>
        <Text c="dimmed" fz="sm">
          ตรวจว่า backoffice API (`/bo/reports/revenue-by-activity`) ทำงานอยู่ที่พอร์ต 4010
        </Text>
      </Card>
    );
  if (!query.data) return null;

  return <ActivityReport data={query.data} />;
}

/**
 * Thai wording per reason code (TASK-084). `VOUCHER` is **expected** and reads calmly; the other two are
 * faults and say so, with `UNKNOWN_CODE` strongest — it means revenue was posted against a product code this
 * report doesn't recognise, which is a bug, not a fact about the month.
 */
const REASON_TEXT: Record<UnattributedCode, { label: string; tone: "expected" | "fault" | "alarm" }> = {
  VOUCHER: {
    label: "วอยเชอร์ — เป็นชั่วโมงรวม ไม่ผูกกับกีฬาใดกีฬาหนึ่งตั้งแต่ตอนขาย (ปกติ)",
    tone: "expected",
  },
  UNRESOLVED_REF: {
    label: "อ้างอิงรายการขายไม่พบ — ควรตรวจสอบ",
    tone: "fault",
  },
  UNKNOWN_CODE: {
    label: "⚠️ รหัสสินค้าไม่รู้จัก — มีการบันทึกรายได้ด้วยรหัสที่รายงานนี้ไม่รู้จัก ต้องตรวจสอบ",
    tone: "alarm",
  },
};

const TONE_CLASS: Record<"expected" | "fault" | "alarm", string> = {
  expected: "text-default-400",
  fault: "text-warning",
  alarm: "text-danger font-medium",
};

function ActivityReport({ data }: { data: RevenueByActivity }) {
  const { totalMinor, buckets, unattributed } = data;
  const unattributedMinor = unattributed.totalMinor;

  // Display ratio only — of the MONTH TOTAL, never of the attributed subset.
  const pct = (minor: number) => (totalMinor > 0 ? (minor / totalMinor) * 100 : 0);

  // The screen states its own reconciliation rather than asking the reader to trust it.
  const attributedMinor = buckets.reduce((sum, b) => sum + b.amountMinor, 0);
  const reconciles = attributedMinor + unattributedMinor === totalMinor;

  if (totalMinor === 0)
    return (
      <Card padding="xl">
        <Center>
          <Text c="dimmed" fz="sm">ยังไม่มียอดขายในเดือนนี้</Text>
        </Center>
      </Card>
    );

  return (
    <div className="space-y-5">
      <Card padding={0} className="overflow-hidden border-default-200/70">
        <div className="relative p-6 sm:p-8">
          <span className="absolute inset-y-0 left-0 w-1 bg-success" />
          <div className="text-xs uppercase tracking-widest text-default-400">ยอดขายรวมทั้งเดือน</div>
          <div className="mt-2 text-5xl font-semibold text-success sm:text-6xl">
            <Figure>{thb(totalMinor)}</Figure>
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <div className="space-y-4">
          {buckets.map((b) => (
            <div key={b.subjectId}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{b.name}</span>
                <span className="text-sm text-default-500">
                  <Figure className="text-foreground">{thb(b.amountMinor)}</Figure>
                  <span className="ml-2 text-xs">{pct(b.amountMinor).toFixed(1)}%</span>
                </span>
              </div>
              <Progress value={pct(b.amountMinor)} color="green" size="sm" radius="xl" />
            </div>
          ))}

          {/* ⚠️ Never hidden, never folded into "other", never filtered out — its own labelled row with the
              reason. A voucher has no sport by nature; that is a fact about the month, not a defect. */}
          <div className="border-t border-default-200/70 pt-4">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-warning">ยังไม่ระบุกีฬา</span>
              <span className="text-sm text-default-500">
                <Figure className="text-foreground">{thb(unattributedMinor)}</Figure>
                <span className="ml-2 text-xs">{pct(unattributedMinor).toFixed(1)}%</span>
              </span>
            </div>
            <Progress value={pct(unattributedMinor)} color="orange" size="sm" radius="xl" />
            {/* One row per reason code, each with its count AND amount — "2 รายการอ้างอิงไม่พบ" doesn't say
                whether to care; "…, ฿4,000" does. An empty array renders nothing at all: a clean month has no
                reasons, and a "0 รายการ" row would invent a problem. An unrecognised code renders raw rather
                than being dropped — a visible unknown beats a silent omission on a money screen. */}
            {unattributed.reasons.length > 0 && (
              <ul className="mt-2 space-y-1">
                {unattributed.reasons.map((r) => {
                  const text = REASON_TEXT[r.code];
                  return (
                    <li
                      key={r.code}
                      className={`flex items-start gap-1.5 text-xs ${text ? TONE_CLASS[text.tone] : TONE_CLASS.alarm}`}
                    >
                      <Info size={13} className="mt-0.5 shrink-0" />
                      <span>
                        {text ? text.label : `รหัสเหตุผลที่ไม่รู้จัก: ${r.code}`}
                        {" · "}
                        {r.count} รายการ · <span className="font-num">{thb(r.amountMinor)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Card>

      {/* The reconciliation is shown, not assumed — if these ever disagree the screen says so loudly. */}
      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-default-500">
            แยกตามกีฬา <Figure className="text-foreground">{thb(attributedMinor)}</Figure>
            {" + "}ยังไม่ระบุ <Figure className="text-foreground">{thb(unattributedMinor)}</Figure>
            {" = "}<Figure className="text-foreground">{thb(attributedMinor + unattributedMinor)}</Figure>
          </span>
          {reconciles ? (
            <Badge color="green" variant="light">ตรงกับยอดรวมทั้งเดือน</Badge>
          ) : (
            <Badge color="red" variant="filled">
              ⚠️ ไม่ตรงกับยอดรวม {thb(totalMinor)}
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
}

function CustomerPanel({ month }: { month: string }) {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const query = useCustomerSpend(month, debounced.trim() || undefined);

  // Reset the box when the month changes so a stale search doesn't read as "this month has no customers".
  useEffect(() => setSearch(""), [month]);

  const customers = useMemo(() => query.data?.customers ?? [], [query.data]);

  return (
    <div className="space-y-4">
      <TextInput
        placeholder="ค้นหาชื่อนักเรียน"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        leftSection={<Search size={15} />}
        size="sm"
        className="max-w-sm"
      />

      {query.isLoading ? (
        <Center h={200}><Loader color="green" /></Center>
      ) : query.isError ? (
        <Card padding="xl">
          <Text c="red" fw={500}>โหลดรายงานไม่สำเร็จ</Text>
          <Text c="dimmed" fz="sm">
            ตรวจว่า backoffice API (`/bo/reports/customer-spend`) ทำงานอยู่ที่พอร์ต 4010
          </Text>
        </Card>
      ) : customers.length === 0 ? (
        <Card padding="xl">
          <Center>
            <Text c="dimmed" fz="sm">
              {debounced.trim() ? "ไม่พบลูกค้าที่ตรงกับคำค้น" : "ยังไม่มียอดใช้จ่ายในเดือนนี้"}
            </Text>
          </Center>
        </Card>
      ) : (
        <Card padding={0} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-default-200/70 bg-default-50/50 text-xs uppercase tracking-wide text-default-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">นักเรียน</th>
                  <th className="px-4 py-3 text-right font-medium">คอร์ส</th>
                  <th className="px-4 py-3 text-right font-medium">วอยเชอร์</th>
                  <th className="px-4 py-3 text-right font-medium">รายครั้ง</th>
                  <th className="px-4 py-3 text-right font-medium">ยอดใช้จ่าย</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c: CustomerSpend) => (
                  <tr key={c.studentId} className="border-b border-default-200/40 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-right font-num text-default-500">{c.courses}</td>
                    <td className="px-4 py-3 text-right font-num text-default-500">{c.vouchers}</td>
                    <td className="px-4 py-3 text-right font-num text-default-500">{c.sessions}</td>
                    <td className="px-4 py-3 text-right font-num text-foreground">
                      {thb(c.totalSpendMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
