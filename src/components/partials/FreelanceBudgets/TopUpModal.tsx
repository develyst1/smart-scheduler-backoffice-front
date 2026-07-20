"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Group, Modal, NumberInput, Stack, Text } from "@mantine/core";
import { budgetMinorOf, useTopUp } from "@/hooks/backoffice/useFreelanceBudgets";
import { ApiClientError } from "@/lib/api/client";
import { notify } from "@/lib/ui/notify";
import { thb, type CatalogItem } from "@/types/app/backoffice";

export function TopUpModal({ item, onClose }: { item: CatalogItem | null; onClose: () => void }) {
  const topUp = useTopUp();
  const [amount, setAmount] = useState<number | string>(0);

  useEffect(() => {
    if (item) setAmount(0);
  }, [item]);

  if (!item) return null;

  const addSatang = Math.round(Number(amount) * 100);
  const nextRemaining = item.quantityOnHand + addSatang;

  const submit = async () => {
    if (addSatang <= 0) {
      notify({ title: "จำนวนต้องมากกว่า 0", color: "warning" });
      return;
    }
    try {
      await topUp.mutateAsync({ itemId: item.id, amountSatang: addSatang });
      notify({
        title: "เติมงบแล้ว",
        description: `${item.name} · +${thb(addSatang)}`,
        color: "success",
      });
      onClose();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "บันทึกไม่สำเร็จ";
      notify({ title: "ผิดพลาด", description: msg, color: "danger" });
    }
  };

  return (
    <Modal opened={!!item} onClose={onClose} title="เติมงบครู (ปลดล็อก)" centered radius="lg">
      <Stack gap="md">
        <div className="rounded-xl border border-default-200 bg-default-50/40 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-default-400">
                งบเดือน {thb(budgetMinorOf(item))} · เรต {thb(item.salePriceMinor)}/ชม.
              </p>
            </div>
            <Badge variant="light" color={item.quantityOnHand <= 0 ? "red" : "gray"} size="lg" className="font-num">
              เหลือ {thb(item.quantityOnHand)}
            </Badge>
          </div>
        </div>

        <NumberInput
          label="จำนวนที่เติม (บาท)"
          value={amount}
          onChange={setAmount}
          min={0}
          thousandSeparator=","
          leftSection={<span className="text-xs text-default-400">฿</span>}
        />

        <Text fz="sm" c="dimmed">
          หลังเติม คงเหลือ:{" "}
          <span className="font-num font-medium text-foreground">{thb(nextRemaining)}</span>
          {" — ไม่กระทบกำไร-ขาดทุน"}
        </Text>

        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button color="green" onClick={submit} loading={topUp.isPending}>
            เติมงบ
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
