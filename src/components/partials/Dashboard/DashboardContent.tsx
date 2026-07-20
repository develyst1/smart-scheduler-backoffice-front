"use client";

import { useState } from "react";
import { Badge, Card, Center, Loader, RingProgress, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import dayjs from "dayjs";
import { ArrowDownRight, ArrowUpRight, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { usePLReport } from "@/hooks/backoffice/useReports";
import {
  ITEM_GROUP_LABEL,
  ITEM_TYPE_LABEL,
  thb,
  type ItemType,
  type PLReport,
} from "@/types/app/backoffice";

const fmt = (d: Date) => dayjs(d).format("YYYY-MM-DD");

/** Monospaced figure — the ledger read. */
function Figure({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-num ${className}`}>{children}</span>;
}

const TYPE_TONE: Record<ItemType, { text: string; bg: string; bar: string }> = {
  INCOME: { text: "text-success", bg: "bg-success/10", bar: "bg-success" },
  EXPENSE: { text: "text-danger", bg: "bg-danger/10", bar: "bg-danger" },
  FIXED_COST: { text: "text-warning", bg: "bg-warning/10", bar: "bg-warning" },
};

export default function DashboardContent() {
  const [range, setRange] = useState<[Date | null, Date | null]>([
    dayjs().startOf("month").toDate(),
    dayjs().toDate(),
  ]);
  const [from, to] = range;
  const query = usePLReport({
    from: from ? fmt(from) : undefined,
    to: to ? fmt(to) : undefined,
  });

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-success/70">Profit &amp; Loss</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            งบกำไร–ขาดทุน
          </h1>
          <p className="mt-0.5 text-sm text-default-400">
            รายรับ ลบ รายจ่าย จากทุกความเคลื่อนไหวของ item
          </p>
        </div>
        <DatePickerInput
          type="range"
          value={range}
          onChange={(v) => setRange(v as [Date | null, Date | null])}
          valueFormat="D MMM YY"
          allowSingleDateInRange
          leftSection={<Scale size={15} />}
          className="w-full sm:w-80"
          size="sm"
        />
      </div>

      {query.isLoading ? (
        <Center h={280}>
          <Loader color="green" />
        </Center>
      ) : query.isError ? (
        <Card padding="xl">
          <Text c="red" fw={500}>
            โหลดงบไม่สำเร็จ
          </Text>
          <Text c="dimmed" fz="sm">
            ตรวจว่า Finance API (`/reports/pl`) ทำงานอยู่ที่พอร์ต 3002
          </Text>
        </Card>
      ) : query.data ? (
        <Report data={query.data} />
      ) : null}
    </div>
  );
}

function Report({ data }: { data: PLReport }) {
  const profitPositive = data.profitMinor >= 0;
  const margin =
    data.revenueMinor > 0 ? Math.round((data.profitMinor / data.revenueMinor) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ── Hero: net profit ── */}
      <Card
        padding={0}
        className="overflow-hidden border-default-200/70"
        style={{ animation: "fadeUp .4s ease both" }}
      >
        <div className="bg-grid relative flex flex-wrap items-center justify-between gap-6 p-6 sm:p-8">
          <span
            className={`absolute inset-y-0 left-0 w-1 ${profitPositive ? "bg-success" : "bg-danger"}`}
          />
          <div>
            <div className="flex items-center gap-2 text-default-400">
              {profitPositive ? (
                <TrendingUp size={16} className="text-success" />
              ) : (
                <TrendingDown size={16} className="text-danger" />
              )}
              <span className="text-xs uppercase tracking-widest">กำไรสุทธิ</span>
            </div>
            <div
              className={`mt-2 text-5xl font-semibold sm:text-6xl ${
                profitPositive ? "text-success" : "text-danger"
              }`}
            >
              <Figure>{profitPositive ? "" : "−"}{thb(Math.abs(data.profitMinor))}</Figure>
            </div>
            <p className="mt-2 text-xs text-default-500">
              {dayjs(data.from).format("D MMM")} – {dayjs(data.to).format("D MMM YYYY")}
            </p>
          </div>
          <RingProgress
            size={128}
            thickness={11}
            roundCaps
            label={
              <div className="text-center">
                <div className={`font-num text-xl font-semibold ${profitPositive ? "text-success" : "text-danger"}`}>
                  {margin}%
                </div>
                <div className="text-[10px] text-default-400">อัตรากำไร</div>
              </div>
            }
            sections={[
              {
                value: Math.min(100, Math.max(0, margin)),
                color: profitPositive ? "green" : "red",
              },
            ]}
          />
        </div>
      </Card>

      {/* ── Revenue / Cost tiles ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyTile
          label="รายรับรวม"
          value={data.revenueMinor}
          tone="success"
          icon={<ArrowUpRight size={18} />}
          delay={0.06}
        />
        <MoneyTile
          label="รายจ่ายรวม"
          value={data.costMinor}
          tone="danger"
          icon={<ArrowDownRight size={18} />}
          delay={0.12}
        />
      </div>

      {/* ── Composition + by item ── */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card padding="lg" className="lg:col-span-2" style={{ animation: "fadeUp .5s ease both" }}>
          <Text fw={600} fz="sm" mb="md">
            แยกตามประเภท
          </Text>
          <ByType data={data} />
        </Card>

        <Card padding="lg" className="lg:col-span-3" style={{ animation: "fadeUp .55s ease both" }}>
          <Text fw={600} fz="sm" mb="md">
            รายการ (เรียงตามมูลค่า)
          </Text>
          <ByItem data={data} />
        </Card>
      </div>
    </div>
  );
}

function MoneyTile({
  label,
  value,
  tone,
  icon,
  delay,
}: {
  label: string;
  value: number;
  tone: "success" | "danger";
  icon: React.ReactNode;
  delay: number;
}) {
  const tint = tone === "success" ? "text-success" : "text-danger";
  const bg = tone === "success" ? "bg-success/10" : "bg-danger/10";
  return (
    <Card padding="lg" style={{ animation: `fadeUp .5s ease both`, animationDelay: `${delay}s` }}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-default-400">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} ${tint}`}>
          {icon}
        </span>
      </div>
      <div className={`mt-3 text-3xl font-semibold ${tint}`}>
        <Figure>{tone === "danger" ? "−" : ""}{thb(value)}</Figure>
      </div>
    </Card>
  );
}

function ByType({ data }: { data: PLReport }) {
  const max = Math.max(1, ...data.byType.map((t) => t.amountMinor));
  const order: ItemType[] = ["INCOME", "EXPENSE", "FIXED_COST"];
  const rows = order
    .map((t) => data.byType.find((x) => x.itemType === t))
    .filter(Boolean) as PLReport["byType"];

  if (!rows.length) return <Empty />;

  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const tone = TYPE_TONE[r.itemType];
        return (
          <div key={r.itemType}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-default-500">{ITEM_TYPE_LABEL[r.itemType]}</span>
              <span className={`font-num font-medium ${tone.text}`}>{thb(r.amountMinor)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-default-100">
              <div
                className={`h-full rounded-full ${tone.bar}`}
                style={{ width: `${(r.amountMinor / max) * 100}%`, transition: "width .5s ease" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ByItem({ data }: { data: PLReport }) {
  const items = [...data.byItem].sort((a, b) => b.amountMinor - a.amountMinor);
  if (!items.length) return <Empty />;

  return (
    <div className="-mx-2 max-h-[360px] overflow-auto">
      <table className="w-full text-sm">
        <tbody>
          {items.map((it) => {
            const tone = TYPE_TONE[it.itemType];
            return (
              <tr key={it.itemId} className="border-b border-default-100/70 last:border-0">
                <td className="px-2 py-2.5">
                  <div className="font-medium text-foreground">{it.name}</div>
                  <div className="text-xs text-default-400">
                    {ITEM_GROUP_LABEL[it.itemGroup]} · {it.sku}
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <Badge size="sm" variant="light" color={MANTINE(it.itemType)}>
                    {ITEM_TYPE_LABEL[it.itemType]}
                  </Badge>
                </td>
                <td className={`px-2 py-2.5 text-right font-num font-medium ${tone.text}`}>
                  {it.itemType === "INCOME" ? "+" : "−"}
                  {thb(it.amountMinor)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MANTINE(t: ItemType) {
  return { INCOME: "green", EXPENSE: "red", FIXED_COST: "orange" }[t];
}

function Empty() {
  return <Text c="dimmed" fz="sm">ยังไม่มีความเคลื่อนไหวในช่วงนี้</Text>;
}
