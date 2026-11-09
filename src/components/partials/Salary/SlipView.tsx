"use client";

import { ActionIcon, Alert, Badge, Card, Table, Text } from "@mantine/core";
import { Trash2 } from "lucide-react";
import { formatBaht, formatSigned, toSatang } from "./money";
import { errorMessage } from "./parts";
import type { LineKind, LineSource, Money } from "@/types/app/salary";

export interface SlipViewLine {
  id: string;
  kind: LineKind;
  kindLabel?: string;
  label: string;
  /** signed satang */
  amount: Money;
  /** absent (the coach's own read does not say) ⇒ not deletable, which is right: a coach never edits */
  source?: LineSource;
}

interface Props {
  baseAmount: Money;
  lines: SlipViewLine[];
  total: Money;
  /** present ⇒ a manual line shows a delete button (the CEO's open slip); absent ⇒ read-only (a locked slip, a coach's own) */
  onRemove?: (lineId: string) => void;
  removingId?: string | null;
  removeError?: unknown;
}

/**
 * The slip body — base, one row per line (kind badge + the per-date label + the signed amount), the total. ONE view for the CEO's slip
 * and a coach's own (TASK-882), so a slip renders once, in one way. It only displays what it is given.
 */
export default function SlipView({ baseAmount, lines, total, onRemove, removingId, removeError }: Props) {
  const shown = lines.filter((l) => l.kind !== "base");
  return (
    <Card mb="md">
      <Table verticalSpacing="sm">
        <Table.Tbody>
          <Table.Tr>
            <Table.Td>เงินเดือนฐาน</Table.Td>
            <Table.Td ta="right" className="font-num" data-slip-base>
              {formatBaht(toSatang(baseAmount))}
            </Table.Td>
            <Table.Td w={44} />
          </Table.Tr>

          {shown.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text c="dimmed" fz="sm">
                  ยังไม่มีรายการเพิ่ม / หัก
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {shown.map((l) => {
            const s = toSatang(l.amount);
            return (
              <Table.Tr key={l.id} data-line={l.id}>
                <Table.Td>
                  <Badge variant="outline" color={l.source === "auto" ? "blue" : "gray"} size="sm" tt="none" mr={8} data-line-kind>
                    {l.kindLabel ?? (l.kind === "other" ? "Other ±" : l.kind)}
                  </Badge>
                  {l.label}
                </Table.Td>
                <Table.Td ta="right" className="font-num" c={s !== null && s < 0 ? "red.4" : undefined} data-line-amount>
                  {formatSigned(s)}
                </Table.Td>
                <Table.Td ta="right">
                  {onRemove && l.source === "manual" && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`ลบรายการ ${l.label}`}
                      loading={removingId === l.id}
                      onClick={() => onRemove(l.id)}
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
              {formatBaht(toSatang(total))}
            </Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Tfoot>
      </Table>
      {removeError ? (
        <Alert color="red" variant="light" mt="sm" role="alert">
          {errorMessage(removeError)}
        </Alert>
      ) : null}
    </Card>
  );
}
