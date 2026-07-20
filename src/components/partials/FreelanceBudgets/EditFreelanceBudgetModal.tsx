"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, NumberInput, Stack, TextInput } from "@mantine/core";
import { Info } from "lucide-react";
import { budgetMinorOf, useUpdateFreelanceBudget } from "@/hooks/backoffice/useFreelanceBudgets";
import { ApiClientError } from "@/lib/api/client";
import { notify } from "@/lib/ui/notify";
import { thb, type CatalogItem } from "@/types/app/backoffice";

const toSatang = (baht: number | string) => Math.round(Number(baht) * 100);

export function EditFreelanceBudgetModal({
  item,
  onClose,
}: {
  item: CatalogItem | null;
  onClose: () => void;
}) {
  const update = useUpdateFreelanceBudget();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState<number | string>(0);
  const [rate, setRate] = useState<number | string>(0);
  const [warn, setWarn] = useState<number | string>("");

  useEffect(() => {
    if (item) {
      setName(item.name);
      setBudget(budgetMinorOf(item) / 100);
      setRate(item.salePriceMinor / 100);
      setWarn(item.reorderLevel != null ? item.reorderLevel / 100 : "");
    }
  }, [item]);

  if (!item) return null;

  const submit = async () => {
    if (!name.trim()) {
      notify({ title: "กรอกชื่อครูก่อน", color: "warning" });
      return;
    }
    if (Number(budget) <= 0) {
      notify({ title: "งบรายเดือนต้องมากกว่า 0", color: "warning" });
      return;
    }
    try {
      await update.mutateAsync({
        itemId: item.id,
        patch: {
          name: name.trim(),
          salePriceMinor: toSatang(rate),
          reorderLevel: warn === "" ? null : toSatang(warn),
          // Shallow-merged server-side → keeps metadata.kind (TASK-009).
          metadata: { monthlyBudgetMinor: toSatang(budget) },
        },
      });
      notify({ title: "แก้ไขงบครูแล้ว", description: name, color: "success" });
      onClose();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "แก้ไขไม่สำเร็จ";
      notify({ title: "ผิดพลาด", description: msg, color: "danger" });
    }
  };

  return (
    <Modal opened={!!item} onClose={onClose} title="แก้ไขงบครูฟรีแลนซ์" centered radius="lg" size="lg">
      <Stack gap="md">
        <TextInput
          label="ชื่อครู"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput label="teacherId (แก้ไม่ได้)" value={item.externalRef ?? "—"} disabled />
        <Group grow>
          <NumberInput
            label="งบรายเดือน (บาท)"
            value={budget}
            onChange={setBudget}
            min={0}
            thousandSeparator=","
            leftSection={<span className="text-xs text-default-400">฿</span>}
          />
          <NumberInput
            label="เรตต่อชั่วโมง (บาท)"
            value={rate}
            onChange={setRate}
            min={0}
            thousandSeparator=","
            leftSection={<span className="text-xs text-default-400">฿</span>}
          />
        </Group>
        <NumberInput
          label="เตือนเมื่อเหลือถึง (บาท) — ไม่บังคับ"
          value={warn}
          onChange={setWarn}
          min={0}
          thousandSeparator=","
          leftSection={<span className="text-xs text-default-400">฿</span>}
        />
        <Alert variant="light" color="blue" icon={<Info size={16} />}>
          การแก้ “งบรายเดือน” เป็นการตั้งยอดสำหรับ<strong>รอบเดือนถัดไป</strong> — งบคงเหลือปัจจุบัน
          ({thb(item.quantityOnHand)}) จะยังไม่เปลี่ยนจนกว่าจะรีเซ็ตต้นเดือน หากต้องการเพิ่มงบคงเหลือทันที
          ให้ใช้ปุ่ม “เติมงบ”
        </Alert>
        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button color="green" onClick={submit} loading={update.isPending}>
            บันทึก
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
