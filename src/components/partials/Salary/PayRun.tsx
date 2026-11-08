"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Group, Modal, NumberInput, Select, Table, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Download, Lock, Play, Plus } from "lucide-react";
import { useCreatePeriod, useExportCsv, useLockPeriod, useOverview, usePeriods, useRunPeriod } from "./hooks";
import { csvName, formatBaht, formatInstant, periodLabel, rangeLabel, toSatang } from "./money";
import { ErrorState, LoadingState, PeriodStatusBadge, SlipStatusBadge, errorMessage } from "./parts";
import type { PayPeriod } from "@/types/app/salary";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(Date.UTC(2000, i, 15)).toLocaleDateString("th-TH-u-ca-gregory", { month: "long", timeZone: "Asia/Bangkok" }),
}));

const byNewest = (a: PayPeriod, b: PayPeriod) => b.year * 12 + b.month - (a.year * 12 + a.month);

/** Pay run / month overview (SPEC-100 §6.1): pick or create a month → Run → people + totals → Lock → Export. */
export default function PayRun() {
  const router = useRouter();
  const search = useSearchParams();
  const periods = usePeriods();
  const sorted = useMemo(() => [...(periods.data ?? [])].sort(byNewest), [periods.data]);
  const periodId = search.get("period") ?? sorted[0]?.id ?? null;
  const overview = useOverview(periodId);

  const create = useCreatePeriod();
  const run = useRunPeriod();
  const lock = useLockPeriod();
  const exportCsv = useExportCsv();

  const now = new Date();
  const [newMonth, setNewMonth] = useState<string | null>(String(now.getMonth() + 1));
  const [newYear, setNewYear] = useState<string | number>(now.getFullYear());
  const [confirmOpen, confirm] = useDisclosure(false);

  const goto = (id: string) => router.replace(`/salary/payrun?period=${id}`);

  const createPeriod = () => {
    const year = Number(newYear);
    if (!newMonth || !Number.isInteger(year) || year < 2000 || year > 2100) return;
    create.mutate({ year, month: Number(newMonth) }, { onSuccess: (p) => goto(p.id) });
  };

  const period = overview.data?.period;
  const slips = overview.data?.slips ?? [];
  const locked = period?.status === "locked";

  const totals = useMemo(() => {
    let base = 0;
    let total = 0;
    for (const s of slips) {
      base += toSatang(s.baseAmount) ?? 0;
      total += toSatang(s.total) ?? 0;
    }
    return { base, total };
  }, [slips]);

  const runNow = () =>
    run.mutate(periodId as string, {
      onSuccess: (r) =>
        notifications.show({ color: "green", message: `Run แล้ว: สร้างสลิปใหม่ ${r.created} · อัปเดต ${r.refreshed}` }),
    });

  const lockNow = () =>
    lock.mutate(periodId as string, {
      onSettled: () => confirm.close(),
      onSuccess: () => notifications.show({ color: "green", message: "ล็อกงวดนี้แล้ว" }),
    });

  const download = () => {
    if (!period) return;
    exportCsv.mutate(
      { periodId: period.id, filename: csvName(period) },
      { onError: () => notifications.show({ color: "red", message: "ส่งออก CSV ไม่สำเร็จ" }) },
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-foreground">Pay run · ภาพรวมรายเดือน</h1>

      {periods.isLoading ? (
        <LoadingState />
      ) : periods.isError ? (
        <ErrorState error={periods.error} onRetry={() => periods.refetch()} />
      ) : (
        <>
          <Card mb="md">
            <Group align="flex-end" gap="md" wrap="wrap">
              <Select
                label="งวดเงินเดือน"
                placeholder={sorted.length ? "เลือกงวด" : "ยังไม่มีงวด — สร้างด้านขวา"}
                data={sorted.map((p) => ({
                  value: p.id,
                  label: `${periodLabel(p)}${p.status === "locked" ? " · ล็อกแล้ว" : ""}`,
                }))}
                value={periodId}
                onChange={(v) => v && goto(v)}
                allowDeselect={false}
                w={260}
              />
              <Select label="เดือน" data={MONTHS} value={newMonth} onChange={setNewMonth} allowDeselect={false} w={150} />
              <NumberInput
                label="ปี (ค.ศ.)"
                value={newYear}
                onChange={setNewYear}
                min={2000}
                max={2100}
                allowDecimal={false}
                thousandSeparator=""
                w={110}
              />
              <Button variant="default" leftSection={<Plus size={16} />} loading={create.isPending} onClick={createPeriod}>
                สร้างงวด
              </Button>
            </Group>
            {create.isError && (
              <Alert color="red" variant="light" mt="sm" role="alert">
                {errorMessage(create.error)}
              </Alert>
            )}
          </Card>

          {periodId === null ? (
            <Text c="dimmed" ta="center" py="xl">
              ยังไม่มีงวดเงินเดือน — เลือกเดือนแล้วกด “สร้างงวด”
            </Text>
          ) : overview.isLoading ? (
            <LoadingState />
          ) : overview.isError || !period ? (
            <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
          ) : (
            <Card>
              <Group justify="space-between" align="flex-start" mb="md" wrap="wrap" gap="md">
                <div>
                  <Group gap="xs">
                    <Text fw={600} fz="lg">
                      {periodLabel(period)}
                    </Text>
                    <PeriodStatusBadge status={period.status} />
                  </Group>
                  {rangeLabel(period) && (
                    <Text c="dimmed" fz="sm" mt={4} data-period-range>
                      ช่วงจ่าย {rangeLabel(period)}
                    </Text>
                  )}
                  <Text c="dimmed" fz="sm" mt={4} data-lock-at={period.lockAt}>
                    {locked
                      ? `ล็อกเมื่อ ${formatInstant(period.lockedAt ?? period.lockAt)}`
                      : `ล็อกอัตโนมัติ ${formatInstant(period.lockAt)} (12:00 วันสุดท้ายของเดือน)`}
                  </Text>
                </div>
                <Group gap="xs" wrap="wrap">
                  <Button
                    leftSection={<Play size={16} />}
                    loading={run.isPending}
                    disabled={locked}
                    onClick={runNow}
                  >
                    Run
                  </Button>
                  <Button
                    variant="default"
                    leftSection={<Lock size={16} />}
                    disabled={locked}
                    onClick={confirm.open}
                  >
                    Lock
                  </Button>
                  <Button
                    variant="default"
                    leftSection={<Download size={16} />}
                    loading={exportCsv.isPending}
                    onClick={download}
                  >
                    Export CSV
                  </Button>
                </Group>
              </Group>

              {run.isError && (
                <Alert color="red" variant="light" mb="sm" role="alert">
                  {errorMessage(run.error)}
                </Alert>
              )}
              {locked && (
                <Alert color="green" variant="light" mb="sm">
                  งวดนี้ล็อกแล้ว — แก้ไขสลิปและ Run ใหม่ไม่ได้ (ดูและ Export ได้)
                </Alert>
              )}

              {slips.length === 0 ? (
                <Text c="dimmed" ta="center" py="lg">
                  ยังไม่มีสลิปในงวดนี้ — กด Run เพื่อสร้างสลิปให้โค้ช FT ทุกคน
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={560}>
                  <Table highlightOnHover verticalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>โค้ช</Table.Th>
                        <Table.Th ta="right">เงินเดือนฐาน</Table.Th>
                        <Table.Th ta="right">รวมสุทธิ</Table.Th>
                        <Table.Th>สถานะ</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {slips.map((s) => (
                        <Table.Tr key={s.id} data-slip-row={s.id}>
                          <Table.Td>
                            <Link
                              href={`/salary/slip/${s.id}?period=${period.id}`}
                              className="text-primary hover:underline"
                            >
                              {s.teacherName || s.teacherId}
                            </Link>
                          </Table.Td>
                          <Table.Td ta="right" className="font-num">
                            {formatBaht(toSatang(s.baseAmount))}
                          </Table.Td>
                          <Table.Td ta="right" className="font-num" fw={600}>
                            {formatBaht(toSatang(s.total))}
                          </Table.Td>
                          <Table.Td>
                            <SlipStatusBadge status={s.status} />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                    <Table.Tfoot>
                      <Table.Tr>
                        <Table.Th>รวม {slips.length} คน</Table.Th>
                        <Table.Th ta="right" className="font-num" data-total-base>
                          {formatBaht(totals.base)}
                        </Table.Th>
                        <Table.Th ta="right" className="font-num" data-total-net>
                          {formatBaht(totals.total)}
                        </Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Tfoot>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Card>
          )}
        </>
      )}

      <Modal opened={confirmOpen} onClose={confirm.close} title="ล็อกงวดนี้เลย?" centered>
        <Text fz="sm">
          เมื่อล็อกแล้ว จะเพิ่ม/ลบรายการ Other ± และ Run ใหม่ไม่ได้อีก{period ? ` (${periodLabel(period)})` : ""}
        </Text>
        {lock.isError && (
          <Alert color="red" variant="light" mt="sm" role="alert">
            {errorMessage(lock.error)}
          </Alert>
        )}
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={confirm.close}>
            ยกเลิก
          </Button>
          <Button color="red" loading={lock.isPending} onClick={lockNow} data-confirm-lock>
            ล็อกเลย
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
