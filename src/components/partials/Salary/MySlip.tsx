"use client";

import { useState } from "react";
import { Alert, Button, Card, Group, Text } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Check, Download, Info } from "lucide-react";
import { useMySlip } from "./hooks";
import MonthPicker from "./MonthPicker";
import { currentYearMonth, fmtDate, formatBaht, periodLabel, rangeLabel } from "./money";
import { ErrorState, LoadingState, PeriodStatusBadge, SlipStatusBadge, errorMessage } from "./parts";
import SlipView from "./SlipView";
import { confirmMySlip } from "@/services/salary.service";
import type { MySlipData, MySlipResponse } from "@/types/app/salary";

/**
 * TASK-902 — «Confirm this slip» is offered only on a `draft` slip whose month is still open and not past its `lockAt`. A confirmed or locked slip, an empty month, or a
 * month whose lock time has passed has no button. (The server is the real gate: it answers 409 LOCKED after 12:00.)
 */
export function canConfirmSlip(data: MySlipResponse | undefined, now: number = Date.now()): data is MySlipData {
  if (!data || "slip" in data) return false;
  return data.status === "draft" && data.period.status === "open" && now < Date.parse(data.period.lockAt);
}

/** The final UI's toast after a confirm, with the total from the 200 body. */
export const confirmedToast = (totalSatang: number): string => `Slip confirmed: ${formatBaht(totalSatang)} ฿ — it can no longer be edited`;

/** The body for one month's answer: the slip, or the empty state when there is none (`{ slip: null }`). Pure: the page feeds it. */
export function MySlipBody({ data }: { data: MySlipResponse }) {
  if ("slip" in data) {
    return (
      <Text c="dimmed" ta="center" py="xl" data-my-slip-empty>
        No slip for this period yet
      </Text>
    );
  }
  const open = data.period.status === "open" && data.status !== "locked";
  return (
    <>
      {open && (
        <Alert icon={<Info size={16} />} color="blue" variant="light" mb="md" data-confirm-by>
          Confirm by <b>{fmtDate(data.period.lockAt)} · before 12:00</b>
        </Alert>
      )}
      <Card mb="md">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap="sm">
            <Text fw={600} fz={20} data-my-slip-name>
              {data.teacherName || data.teacherId}
            </Text>
            <SlipStatusBadge status={data.status} />
            <PeriodStatusBadge status={data.period.status} />
          </Group>
          <Text c="dimmed" size="sm">
            {periodLabel(data.period)}
            {rangeLabel(data.period) ? ` · ${rangeLabel(data.period)}` : ""}
          </Text>
        </Group>
      </Card>
      {/* The coach's own read says `amountSatang`; the shared slip view says `amount`. Read-only: no onRemove. */}
      <SlipView
        baseAmount={data.baseAmount}
        lines={data.lines.map((l) => ({ id: l.id, kind: l.kind, kindLabel: l.kindLabel, label: l.label, amount: l.amountSatang }))}
        total={data.total}
      />
    </>
  );
}

/** SALARY › Payment Detail — the coach's OWN slip for a month (SPEC-102 §5-E1). The server takes the teacher from the token. */
export default function MySlip() {
  const [ym, setYm] = useState(currentYearMonth);
  const q = useMySlip(ym.year, ym.month);
  const qc = useQueryClient();
  const confirm = useMutation({
    mutationFn: () => confirmMySlip(ym.year, ym.month),
    onSuccess: (slip) => notifications.show({ color: "green", message: confirmedToast(slip.total) }),
    // the server's own sentence (409 LOCKED · 404 NO_SLIP · 403 NO_TEACHER), unchanged
    onError: (e) => notifications.show({ color: "red", message: errorMessage(e) }),
    // success OR a 409: re-read, so the screen shows Confirmed / AUTO-LOCKED, not what was typed on
    onSettled: () => qc.invalidateQueries({ queryKey: ["salary", "my-slip"] }),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payment Detail</h1>
        <Group gap="xs">
          {canConfirmSlip(q.data) && (
            <Button leftSection={<Check size={16} />} loading={confirm.isPending} onClick={() => confirm.mutate()} data-confirm-slip>
              Confirm this slip
            </Button>
          )}
          {/* TODO(TASK-879 wiring): the slip export is CEO-only on the back for now; this stays visible and inert until a coach route exists */}
          <Button variant="default" leftSection={<Download size={16} />} disabled data-export-pdf>
            Export PDF
          </Button>
        </Group>
      </div>
      <Group mb="md">
        <MonthPicker year={ym.year} month={ym.month} onChange={setYm} />
      </Group>
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <MySlipBody data={q.data} />
      )}
    </div>
  );
}
