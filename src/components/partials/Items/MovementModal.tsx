"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Group, Modal, NumberInput, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import { useApplyMovement } from "@/hooks/backoffice/useCatalog";
import { ApiClientError } from "@/lib/api/client";
import { notify } from "@/lib/ui/notify";
import { thb, type CatalogItem, type StockDirection } from "@/types/app/backoffice";

export function MovementModal({ item, onClose }: { item: CatalogItem | null; onClose: () => void }) {
  const move = useApplyMovement();
  const [direction, setDirection] = useState<StockDirection>("IN");
  const [qty, setQty] = useState<number | string>(1);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (item) {
      setDirection(item.itemType === "INCOME" ? "OUT" : "IN");
      setQty(1);
      setReason("");
    }
  }, [item]);

  if (!item) return null;

  const q = Number(qty) || 0;
  const estAmount = q * item.salePriceMinor;
  const isIncome = item.itemType === "INCOME";

  const submit = async () => {
    if (q <= 0) {
      notify({ title: "จำนวนต้องมากกว่า 0", color: "warning" });
      return;
    }
    try {
      await move.mutateAsync({
        itemId: item.id,
        input: { direction, quantity: q, reason: reason.trim() || undefined },
      });
      notify({
        title: direction === "IN" ? "รับเข้าแล้ว" : "ตัดออกแล้ว",
        description: `${item.name} · ${q} ${item.unit}`,
        color: "success",
      });
      onClose();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "บันทึกไม่สำเร็จ";
      notify({ title: "ผิดพลาด", description: msg, color: "danger" });
    }
  };

  return (
    <Modal opened={!!item} onClose={onClose} title="เคลื่อนไหวสต๊อก / โควต้า" centered radius="lg">
      <Stack gap="md">
        <div className="rounded-xl border border-default-200 bg-default-50/40 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-default-400">
                {item.sku} · {thb(item.salePriceMinor)}/{item.unit}
              </p>
            </div>
            {item.trackStock && (
              <Badge variant="light" color="gray" size="lg" className="font-num">
                คงเหลือ {item.quantityOnHand}
              </Badge>
            )}
          </div>
        </div>

        <SegmentedControl
          value={direction}
          onChange={(v) => setDirection(v as StockDirection)}
          fullWidth
          color={direction === "IN" ? "green" : "red"}
          data={[
            { value: "IN", label: isIncome ? "รับสต๊อก" : "เติมโควต้า" },
            { value: "OUT", label: isIncome ? "ขายออก" : "ตัดออก" },
          ]}
        />

        <Group grow>
          <NumberInput label={`จำนวน (${item.unit})`} value={qty} onChange={setQty} min={1} />
          <TextInput label="เหตุผล (ไม่บังคับ)" placeholder="เช่น ขายหน้าร้าน" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        </Group>

        <Text fz="sm" c="dimmed">
          มูลค่าที่จะบันทึกใน P&amp;L:{" "}
          <span className={`font-num font-medium ${direction === "OUT" ? (isIncome ? "text-success" : "text-danger") : "text-default-500"}`}>
            {direction === "OUT" ? (isIncome ? "+" : "−") : ""}
            {thb(estAmount)}
          </span>
          {direction === "IN" && " (รับเข้าไม่กระทบกำไร-ขาดทุน)"}
        </Text>

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button color={direction === "IN" ? "green" : "red"} onClick={submit} loading={move.isPending}>
            ยืนยัน
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
