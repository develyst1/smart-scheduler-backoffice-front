"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Group, Modal, NumberInput, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import { useApplyBoMovement } from "@/hooks/backoffice/useBo";
import { ApiClientError } from "@/lib/api/client";
import { notify } from "@/lib/ui/notify";
import { thb, type BoItem } from "@/types/app/bo";

// bo movement: qty is signed (+ in / − out). value_minor = −qty × unit_price, so OUT books
// positive value (a sale for INCOME items, a spend for EXPENSE items) and IN is a restock/reversal.
export function BoMovementModal({ item, onClose }: { item: BoItem | null; onClose: () => void }) {
  const move = useApplyBoMovement();
  const [dir, setDir] = useState<"OUT" | "IN">("OUT");
  const [qty, setQty] = useState<number | string>(1);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (item) {
      setDir("OUT");
      setQty(1);
      setReason("");
    }
  }, [item]);

  if (!item) return null;

  const magnitude = Number(qty) || 0;
  const signedQty = dir === "OUT" ? -magnitude : magnitude;
  const valueMinor = magnitude * item.unitPriceMinor;
  const tracksCeiling = item.ceilingQty != null;
  const nextRemaining = tracksCeiling ? (item.remainingQty ?? 0) + signedQty : null;

  const submit = async () => {
    if (magnitude <= 0) {
      notify({ title: "จำนวนต้องมากกว่า 0", color: "warning" });
      return;
    }
    try {
      await move.mutateAsync({
        itemId: item.id,
        input: { qty: signedQty, reason: reason.trim() || undefined },
      });
      notify({
        title: dir === "OUT" ? "ตัดออกแล้ว" : "รับเข้าแล้ว",
        description: `${item.name} · ${magnitude} ${item.unit}`,
        color: "success",
      });
      onClose();
    } catch (e) {
      notify({ title: "ผิดพลาด", description: e instanceof ApiClientError ? e.message : "บันทึกไม่สำเร็จ", color: "danger" });
    }
  };

  return (
    <Modal opened={!!item} onClose={onClose} title="เคลื่อนไหว item (เข้า/ออก)" centered radius="lg">
      <Stack gap="md">
        <div className="rounded-xl border border-default-200 bg-default-50/40 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-default-400">
                {thb(item.unitPriceMinor)}/{item.unit}
              </p>
            </div>
            {tracksCeiling && (
              <Badge variant="light" color="gray" size="lg" className="font-num">
                เหลือ {item.remainingQty} {item.unit}
              </Badge>
            )}
          </div>
        </div>

        <SegmentedControl
          value={dir}
          onChange={(v) => setDir(v as "OUT" | "IN")}
          fullWidth
          color={dir === "IN" ? "green" : "red"}
          data={[
            { value: "OUT", label: "ออก (ขาย/ใช้)" },
            { value: "IN", label: "เข้า (รับ/คืน)" },
          ]}
        />

        <Group grow>
          <NumberInput label={`จำนวน (${item.unit})`} value={qty} onChange={setQty} min={1} />
          <TextInput label="เหตุผล (ไม่บังคับ)" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        </Group>

        <Text fz="sm" c="dimmed">
          มูลค่าใน P&amp;L: <span className="font-num font-medium">{dir === "OUT" ? "+" : "−"}{thb(valueMinor)}</span>
          {nextRemaining != null && <> · คงเหลือหลังทำรายการ: <span className="font-num">{nextRemaining} {item.unit}</span></>}
        </Text>

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>ยกเลิก</Button>
          <Button color={dir === "IN" ? "green" : "red"} onClick={submit} loading={move.isPending}>ยืนยัน</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
