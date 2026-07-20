"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, NumberInput, Select, Stack, TextInput } from "@mantine/core";
import { Info } from "lucide-react";
import { useSetRecurringCost } from "@/hooks/backoffice/useRecurring";
import { ApiClientError } from "@/lib/api/client";
import { notify } from "@/lib/ui/notify";
import type { TeacherType } from "@/services/recurring.service";

const toSatang = (baht: number | string) => Math.round(Number(baht) * 100);
const currentMonth = () => new Date().toISOString().slice(0, 7); // "YYYY-MM"

export interface SalaryPreset {
  externalRef: string;
  label: string | null;
  teacherType: string | null;
}

export function SetSalaryModal({
  opened,
  preset,
  onClose,
}: {
  opened: boolean;
  preset: SalaryPreset | null;
  onClose: () => void;
}) {
  const set = useSetRecurringCost();
  const isChange = !!preset;
  const [teacherId, setTeacherId] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<TeacherType>("FULL_TIME");
  const [amount, setAmount] = useState<number | string>(0);
  const [effectiveFrom, setEffectiveFrom] = useState(currentMonth());

  useEffect(() => {
    if (!opened) return;
    setTeacherId(preset?.externalRef ?? "");
    setLabel(preset?.label ?? "");
    setType((preset?.teacherType as TeacherType) || "FULL_TIME");
    setAmount(0);
    setEffectiveFrom(currentMonth());
  }, [opened, preset]);

  const submit = async () => {
    if (!teacherId.trim()) {
      notify({ title: "กรอก teacherId ก่อน", color: "warning" });
      return;
    }
    if (Number(amount) <= 0) {
      notify({ title: "เงินเดือนต้องมากกว่า 0", color: "warning" });
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(effectiveFrom)) {
      notify({ title: "เลือกเดือนที่มีผล (ปปปป-ดด)", color: "warning" });
      return;
    }
    try {
      await set.mutateAsync({
        externalRef: teacherId.trim(),
        label: label.trim() || undefined,
        amountMinor: toSatang(amount),
        effectiveFrom,
        teacherType: type,
      });
      notify({
        title: isChange ? "ปรับเงินเดือนแล้ว" : "ตั้งเงินเดือนแล้ว",
        description: `${label || teacherId} · มีผล ${effectiveFrom}`,
        color: "success",
      });
      onClose();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "บันทึกไม่สำเร็จ";
      notify({ title: "ผิดพลาด", description: msg, color: "danger" });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isChange ? "ปรับเงินเดือน (มีผลตามเดือน)" : "ตั้งเงินเดือนครูประจำ/พาร์ทไทม์"}
      centered
      radius="lg"
      size="lg"
    >
      <Stack gap="md">
        <Group grow>
          <TextInput
            label="ชื่อครู"
            placeholder="เช่น ครูแอน"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
          />
          <TextInput
            label="teacherId"
            placeholder="เช่น 3"
            value={teacherId}
            onChange={(e) => setTeacherId(e.currentTarget.value)}
            disabled={isChange}
            required
          />
        </Group>
        <Group grow>
          <Select
            label="ประเภทครู"
            value={type}
            onChange={(v) => setType((v as TeacherType) ?? "FULL_TIME")}
            data={[
              { value: "FULL_TIME", label: "ประจำ (Full-time)" },
              { value: "PART_TIME", label: "พาร์ทไทม์ (Part-time)" },
            ]}
            allowDeselect={false}
          />
          <NumberInput
            label="เงินเดือน/เดือน (บาท)"
            value={amount}
            onChange={setAmount}
            min={0}
            thousandSeparator=","
            leftSection={<span className="text-xs text-default-400">฿</span>}
          />
        </Group>
        <TextInput
          type="month"
          label="มีผลตั้งแต่เดือน"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.currentTarget.value)}
          required
        />
        <Alert variant="light" color="blue" icon={<Info size={16} />}>
          เงินเดือนใหม่มีผล<strong>ตั้งแต่เดือนที่เลือกเป็นต้นไป</strong> — เดือนก่อนหน้าจะไม่ถูกแก้
          (P&amp;L ย้อนหลังคงเดิม) ระบบจะบันทึกเป็นค่าใช้จ่ายคงที่อัตโนมัติทุกเดือนตอนต้นเดือน
        </Alert>
        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button color="green" onClick={submit} loading={set.isPending}>
            บันทึก
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
