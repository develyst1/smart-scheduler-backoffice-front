"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ActionIcon, Alert, Button, Card, Group, NumberInput, Table, Text, TextInput } from "@mantine/core";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useAddLine, useRemoveLine, useSlip } from "./hooks";
import { bahtInputToSatang, formatBaht, formatInstant, formatSigned, periodLabel, rangeLabel, toSatang } from "./money";
import { ErrorState, LoadingState, PeriodStatusBadge, SlipStatusBadge, errorMessage, isLocked } from "./parts";

type Field = "label" | "amount";

/** One coach's slip (SPEC-100 §6.2): base, the Other ± lines, the total; add / remove a line while open, read-only when locked. */
export default function Slip({ slipId }: { slipId: string }) {
  const search = useSearchParams();
  const slip = useSlip(slipId);
  const add = useAddLine(slipId);
  const remove = useRemoveLine(slipId);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<string | number>("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const backHref = `/salary/payrun?period=${search.get("period") ?? slip.data?.period.id ?? ""}`;

  const submit = () => {
    const next: Partial<Record<Field, string>> = {};
    if (!label.trim()) next.label = "ต้องระบุเหตุผล";
    const satang = amount === "" ? null : bahtInputToSatang(amount);
    if (satang === null || satang === 0) next.amount = "ใส่จำนวนเงิน (ติดลบได้) และต้องไม่เป็น 0";
    setErrors(next);
    if (Object.keys(next).length > 0 || satang === null) return;
    add.mutate(
      { label: label.trim(), amount: satang },
      {
        onSuccess: () => {
          setLabel("");
          setAmount("");
        },
      },
    );
  };

  const data = slip.data;
  const locked = data ? data.status === "locked" || data.period.status === "locked" : false;
  const lines = (data?.lines ?? []).filter((l) => l.kind !== "base");

  return (
    <div className="mx-auto max-w-3xl">
      <Button component={Link} href={backHref} variant="subtle" color="gray" leftSection={<ArrowLeft size={16} />} mb="sm">
        กลับไป Pay run
      </Button>

      {slip.isLoading ? (
        <LoadingState />
      ) : slip.isError || !data ? (
        <ErrorState error={slip.error} onRetry={() => slip.refetch()} />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                สลิป · {data.teacherName || data.teacherId}
              </h1>
              <Text c="dimmed" fz="sm" mt={2}>
                {periodLabel(data.period)}
                {rangeLabel(data.period) ? ` · ช่วงจ่าย ${rangeLabel(data.period)}` : ""}
              </Text>
            </div>
            <Group gap="xs">
              <PeriodStatusBadge status={data.period.status} />
              <SlipStatusBadge status={data.status} />
            </Group>
          </div>

          {locked && (
            <Alert color="green" variant="light" mb="md" data-slip-locked>
              สลิปนี้ล็อกแล้ว{data.period.lockedAt ? ` เมื่อ ${formatInstant(data.period.lockedAt)}` : ""} — ดูได้อย่างเดียว
            </Alert>
          )}

          <Card mb="md">
            <Table verticalSpacing="sm">
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>เงินเดือนฐาน</Table.Td>
                  <Table.Td ta="right" className="font-num" data-slip-base>
                    {formatBaht(toSatang(data.baseAmount))}
                  </Table.Td>
                  <Table.Td w={44} />
                </Table.Tr>

                {lines.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text c="dimmed" fz="sm">
                        ยังไม่มีรายการ Other ±
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {lines.map((l) => {
                  const s = toSatang(l.amount);
                  return (
                    <Table.Tr key={l.id} data-line={l.id}>
                      <Table.Td>
                        <Text span c="dimmed" fz="xs" mr={8}>
                          Other ±
                        </Text>
                        {l.label}
                      </Table.Td>
                      <Table.Td
                        ta="right"
                        className="font-num"
                        c={s !== null && s < 0 ? "red.4" : undefined}
                        data-line-amount
                      >
                        {formatSigned(s)}
                      </Table.Td>
                      <Table.Td ta="right">
                        {!locked && l.source === "manual" && (
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label={`ลบรายการ ${l.label}`}
                            loading={remove.isPending && remove.variables === l.id}
                            onClick={() => remove.mutate(l.id)}
                          >
                            <Trash2 size={16} />
                          </ActionIcon>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th>รวมสุทธิ</Table.Th>
                  <Table.Th ta="right" className="font-num" fz="lg" data-slip-total>
                    {formatBaht(toSatang(data.total))}
                  </Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Tfoot>
            </Table>
            {remove.isError && (
              <Alert color="red" variant="light" mt="sm" role="alert">
                {errorMessage(remove.error)}
              </Alert>
            )}
          </Card>

          {!locked && (
            <Card>
              <Text fw={600} mb="sm">
                เพิ่มรายการ Other ±
              </Text>
              <Group align="flex-start" gap="md" wrap="wrap">
                <TextInput
                  label="เหตุผล"
                  placeholder="เช่น โบนัสพิเศษ / หักมาสาย"
                  value={label}
                  onChange={(e) => setLabel(e.currentTarget.value)}
                  error={errors.label}
                  maxLength={200}
                  className="min-w-[220px] flex-1"
                />
                <NumberInput
                  label="จำนวนเงิน (บาท)"
                  description="ติดลบ = หักเงิน"
                  placeholder="0.00"
                  value={amount}
                  onChange={setAmount}
                  error={errors.amount}
                  allowNegative
                  decimalScale={2}
                  thousandSeparator=","
                  w={190}
                />
                <Button mt={25} leftSection={<Plus size={16} />} loading={add.isPending} onClick={submit}>
                  เพิ่ม
                </Button>
              </Group>
              {add.isError && (
                <Alert color="red" variant="light" mt="sm" role="alert">
                  {isLocked(add.error) ? "งวดนี้ถูกล็อกแล้ว — เพิ่มรายการไม่ได้" : errorMessage(add.error)}
                </Alert>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
