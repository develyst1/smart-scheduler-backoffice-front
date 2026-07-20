"use client";

import { useState } from "react";
import { Button, Group, Modal, NumberInput, Stack, TextInput } from "@mantine/core";
import { useCreateFreelanceBudget } from "@/hooks/backoffice/useFreelanceBudgets";
import { ApiClientError } from "@/lib/api/client";
import { notify } from "@/lib/ui/notify";

const toSatang = (baht: number | string) => Math.round(Number(baht) * 100);

export function CreateFreelanceBudgetModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const create = useCreateFreelanceBudget();
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [budget, setBudget] = useState<number | string>(0);
  const [rate, setRate] = useState<number | string>(0);
  const [warn, setWarn] = useState<number | string>("");

  const reset = () => {
    setName("");
    setTeacherId("");
    setBudget(0);
    setRate(0);
    setWarn("");
  };

  const submit = async () => {
    if (!name.trim() || !teacherId.trim()) {
      notify({ title: "กรอกชื่อครูและ teacherId ก่อน", color: "warning" });
      return;
    }
    if (Number(budget) <= 0) {
      notify({ title: "งบรายเดือนต้องมากกว่า 0", color: "warning" });
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        teacherId: teacherId.trim(),
        monthlyBudgetMinor: toSatang(budget),
        rateMinor: toSatang(rate),
        reorderLevelMinor: warn === "" ? null : toSatang(warn),
      });
      notify({ title: "เพิ่มงบครูแล้ว", description: name, color: "success" });
      reset();
      onClose();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "เพิ่มไม่สำเร็จ";
      notify({ title: "ผิดพลาด", description: msg, color: "danger" });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="เพิ่มงบครูฟรีแลนซ์" centered radius="lg" size="lg">
      <Stack gap="md">
        <Group grow>
          <TextInput
            label="ชื่อครู"
            placeholder="เช่น ครูมาร์ค"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="teacherId (เชื่อม frontoffice)"
            placeholder="เช่น 12"
            value={teacherId}
            onChange={(e) => setTeacherId(e.currentTarget.value)}
            required
          />
        </Group>
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
          description="งบคงเหลือถึงระดับนี้จะขึ้นเตือน ‘ใกล้เต็มงบ’"
          value={warn}
          onChange={setWarn}
          min={0}
          thousandSeparator=","
          leftSection={<span className="text-xs text-default-400">฿</span>}
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button color="green" onClick={submit} loading={create.isPending}>
            บันทึก
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
