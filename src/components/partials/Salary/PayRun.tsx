"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Group, Modal, NumberInput, Select, Table, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Download, Lock, Play, Plus } from "lucide-react";
import { useCreatePeriod, useExportCsv, useLockPeriod, useOverview, usePeriods, useRunPeriod } from "./hooks";
import { csvName, formatBaht, formatInstant, periodLabel, rangeLabel, shortDate, toSatang } from "./money";
import { ErrorState, LoadingState, PeriodStatusBadge, SlipStatusBadge, errorMessage, isPeriodExists } from "./parts";
import type { PayPeriod, RunResult, RunWarning } from "@/types/app/salary";

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(Date.UTC(2000, i, 15)).toLocaleDateString("en-GB", { month: "long", timeZone: "Asia/Bangkok" }),
}));

const CLASS_LABEL: Record<string, string> = { private: "Private", duo: "Duo", group: "Group", eca: "ECA", camp: "Camp" };

/** "Run done: 1 new slip · 2 updated · Auto lines: 3 added · 1 changed · 1 removed" — only what the BE reported; no autoLines ⇒ it says nothing changed. */
function runSummary(r: RunResult): string {
  const auto = r.autoLines
    ? `Auto lines: ${r.autoLines.inserted} added · ${r.autoLines.updated} changed · ${r.autoLines.removed} removed`
    : "Auto lines unchanged";
  return `Run done: ${r.created} new ${r.created === 1 ? "slip" : "slips"} · ${r.refreshed} updated · ${auto}`;
}

const byNewest =(a: PayPeriod, b: PayPeriod) => b.year * 12 + b.month - (a.year * 12 + a.month);

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

  // What the last Run did, kept on screen (a toast vanishes; a missing-rate warning must not). Tied to its period.
  // Kept in sessionStorage per period: opening a slip and coming back (or a reload) must not hide a missing-rate warning. The BE sends
  // `warnings` only in the run response, so this is "as of the last Run" until the overview carries them (asked in TASK-881 ## Questions).
  const [last, setLast] = useState<{ periodId: string; result: RunResult } | null>(null);
  const stored = useMemo<RunResult | null>(() => {
    if (!periodId) return null;
    try {
      const raw = sessionStorage.getItem(`salary-last-run:${periodId}`);
      return raw ? (JSON.parse(raw) as RunResult) : null;
    } catch {
      return null;
    }
  }, [periodId, last]);
  const lastHere = last && last.periodId === periodId ? last.result : stored;
  const nameOf = useMemo(() => new Map(slips.map((s) => [s.teacherId, s.teacherName || s.teacherId])), [slips]);
  const warningsByTeacher = useMemo(() => {
    const m = new Map<string, RunWarning[]>();
    for (const w of lastHere?.warnings ?? []) m.set(w.teacherId, [...(m.get(w.teacherId) ?? []), w]);
    return [...m.entries()];
  }, [lastHere]);

  const runNow = () =>
    run.mutate(periodId as string, {
      onSuccess: (r) => {
        try {
          sessionStorage.setItem(`salary-last-run:${periodId}`, JSON.stringify(r));
        } catch {
          /* storage unavailable: the banner still shows for this visit */
        }
        setLast({ periodId: periodId as string, result: r });
        notifications.show({ color: "green", message: runSummary(r) });
      },
    });

  const lockNow = () =>
    lock.mutate(periodId as string, {
      onSettled: () => confirm.close(),
      onSuccess: () => notifications.show({ color: "green", message: "Period locked" }),
    });

  const download = () => {
    if (!period) return;
    exportCsv.mutate(
      { periodId: period.id, filename: csvName(period) },
      { onError: () => notifications.show({ color: "red", message: "CSV export failed" }) },
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-foreground">Pay run · Monthly overview</h1>

      {periods.isLoading ? (
        <LoadingState />
      ) : periods.isError ? (
        <ErrorState error={periods.error} onRetry={() => periods.refetch()} />
      ) : (
        <>
          <Card mb="md">
            <Group align="flex-end" gap="md" wrap="wrap">
              <Select
                label="Pay period"
                placeholder={sorted.length ? "Choose a period" : "No periods yet — create one on the right"}
                data={sorted.map((p) => ({
                  value: p.id,
                  label: `${periodLabel(p)}${p.status === "locked" ? " · Locked" : ""}`,
                }))}
                value={periodId}
                onChange={(v) => v && goto(v)}
                allowDeselect={false}
                w={260}
              />
              <Select label="Month" data={MONTHS} value={newMonth}
                onChange={(v) => {
                  setNewMonth(v);
                  create.reset();
                }}
                allowDeselect={false}
                w={150}
              />
              <NumberInput
                label="Year"
                value={newYear}
                onChange={(v) => {
                  setNewYear(v);
                  create.reset();
                }}
                min={2000}
                max={2100}
                allowDecimal={false}
                thousandSeparator=""
                w={110}
              />
              <Button variant="default" leftSection={<Plus size={16} />} loading={create.isPending} onClick={createPeriod}>
                Create period
              </Button>
            </Group>
            {create.isError && (
              <Alert color="red" variant="light" mt="sm" role="alert" data-create-error>
                {isPeriodExists(create.error)
                  ? `The ${periodLabel({ year: Number(newYear), month: Number(newMonth) })} period already exists — pick it from the “Pay period” list above.`
                  : errorMessage(create.error)}
              </Alert>
            )}
          </Card>

          {periodId === null ? (
            <Text c="dimmed" ta="center" py="xl">
              No pay periods yet — choose a month and press “Create period”.
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
                      Pay range {rangeLabel(period)}
                    </Text>
                  )}
                  <Text c="dimmed" fz="sm" mt={4} data-lock-at={period.lockAt}>
                    {locked
                      ? `Locked on ${formatInstant(period.lockedAt ?? period.lockAt)}`
                      : `Locks automatically on ${formatInstant(period.lockAt)} (the last day of the month)`}
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
              {lastHere && (
                <Alert color="blue" variant="light" mb="sm" data-run-summary>
                  {runSummary(lastHere).replace("Run done", "Last run")}
                </Alert>
              )}
              {warningsByTeacher.length > 0 && (
                <Alert color="yellow" variant="light" mb="sm" title="Freelance rate not set — these days are not paid yet" data-run-warnings>
                  <ul className="m-0 list-disc pl-5">
                    {warningsByTeacher.map(([tid, ws]) => (
                      <li key={tid}>
                        <b>{nameOf.get(tid) ?? tid}</b>:{" "}
                        {ws.map((w) => `${shortDate(w.date)} (${CLASS_LABEL[w.classType] ?? w.classType})`).join(" · ")}
                      </li>
                    ))}
                  </ul>
                  <Text fz="xs" mt={6}>
                    Set that coach's rate, then press Run again — the lines are added automatically.
                  </Text>
                </Alert>
              )}
              {locked && (
                <Alert color="green" variant="light" mb="sm">
                  This period is locked — slips cannot be edited and it cannot be run again (you can still view and export).
                </Alert>
              )}

              {slips.length === 0 ? (
                <Text c="dimmed" ta="center" py="lg">
                  No slips in this period yet — press Run to create a slip for every FT coach.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={560}>
                  <Table highlightOnHover verticalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Coach</Table.Th>
                        <Table.Th ta="right">Base salary</Table.Th>
                        <Table.Th ta="right">Net total</Table.Th>
                        <Table.Th>Status</Table.Th>
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
                        <Table.Th>Total · {slips.length} {slips.length === 1 ? "coach" : "coaches"}</Table.Th>
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

      <Modal opened={confirmOpen} onClose={confirm.close} title="Lock this period?" centered>
        <Text fz="sm">
          Once locked, Other ± lines can no longer be added or removed and the period cannot be run again{period ? ` (${periodLabel(period)})` : ""}
        </Text>
        {lock.isError && (
          <Alert color="red" variant="light" mt="sm" role="alert">
            {errorMessage(lock.error)}
          </Alert>
        )}
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={confirm.close}>
            Cancel
          </Button>
          <Button color="red" loading={lock.isPending} onClick={lockNow} data-confirm-lock>
            Lock
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
