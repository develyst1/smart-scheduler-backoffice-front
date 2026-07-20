"use client";

import { useState } from "react";
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { useCreateItem } from "@/hooks/backoffice/useCatalog";
import { ApiClientError } from "@/lib/api/client";
import { notify } from "@/lib/ui/notify";
import { ITEM_GROUP_LABEL, ITEM_TYPE_LABEL, type ItemGroup, type ItemType } from "@/types/app/backoffice";

const TYPE_HINT: Record<ItemType, string> = {
  INCOME: "ขายออก = รายรับเข้าบริษัท",
  EXPENSE: "ตัดออก = ต้นทุน (เช่น ค่าครูรายชั่วโมง)",
  FIXED_COST: "ต้นทุนคงที่รายเดือน (ค่าเช่า, เงินเดือน ฯลฯ)",
};

export function CreateItemModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const create = useCreateItem();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [group, setGroup] = useState<ItemGroup>("PRODUCT");
  const [type, setType] = useState<ItemType>("INCOME");
  const [unit, setUnit] = useState("ชิ้น");
  const [price, setPrice] = useState<number | string>(0);
  const [trackStock, setTrackStock] = useState(true);
  const [externalRef, setExternalRef] = useState("");

  const reset = () => {
    setName("");
    setSku("");
    setGroup("PRODUCT");
    setType("INCOME");
    setUnit("ชิ้น");
    setPrice(0);
    setTrackStock(true);
    setExternalRef("");
  };

  const submit = async () => {
    if (!name.trim() || !sku.trim()) {
      notify({ title: "กรอกชื่อและ SKU ก่อน", color: "warning" });
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        sku: sku.trim(),
        unit: unit.trim() || "ชิ้น",
        itemGroup: group,
        itemType: type,
        salePriceMinor: Math.round(Number(price) * 100),
        trackStock,
        externalRef: externalRef.trim() || undefined,
        externalSource: externalRef.trim() ? "manual" : undefined,
      });
      notify({ title: "เพิ่ม item แล้ว", description: name, color: "success" });
      reset();
      onClose();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "เพิ่มไม่สำเร็จ";
      notify({ title: "ผิดพลาด", description: msg, color: "danger" });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="เพิ่ม item ใหม่" centered radius="lg" size="lg">
      <Stack gap="md">
        <TextInput label="ชื่อ" placeholder="เช่น น้ำดื่ม 600ml / ครูมาร์ค / ค่าเช่าสถานที่" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
        <Group grow>
          <TextInput label="SKU (รหัส)" placeholder="WATER-600" value={sku} onChange={(e) => setSku(e.currentTarget.value)} required />
          <TextInput label="หน่วยนับ" placeholder="ชิ้น / ชม. / เดือน" value={unit} onChange={(e) => setUnit(e.currentTarget.value)} />
        </Group>
        <Group grow>
          <Select
            label="กลุ่ม"
            value={group}
            onChange={(v) => setGroup((v as ItemGroup) ?? "PRODUCT")}
            data={(Object.keys(ITEM_GROUP_LABEL) as ItemGroup[]).map((g) => ({ value: g, label: ITEM_GROUP_LABEL[g] }))}
            allowDeselect={false}
          />
          <Select
            label="ประเภทบัญชี"
            value={type}
            onChange={(v) => setType((v as ItemType) ?? "INCOME")}
            data={(Object.keys(ITEM_TYPE_LABEL) as ItemType[]).map((t) => ({ value: t, label: ITEM_TYPE_LABEL[t] }))}
            description={TYPE_HINT[type]}
            allowDeselect={false}
          />
        </Group>
        <Group grow align="flex-end">
          <NumberInput
            label="ราคา/ต้นทุน ต่อหน่วย (บาท)"
            value={price}
            onChange={setPrice}
            min={0}
            thousandSeparator=","
            leftSection={<span className="text-xs text-default-400">฿</span>}
          />
          <Switch
            label="นับสต๊อก/โควต้า"
            description="สินค้า+ครูควรเปิด · รายรับ/ค่าคงที่แบบไม่จำกัดปิดได้"
            checked={trackStock}
            onChange={(e) => setTrackStock(e.currentTarget.checked)}
            color="green"
            mb={6}
          />
        </Group>
        <TextInput
          label="เชื่อมกับ frontoffice (external ref) — ไม่บังคับ"
          placeholder="เช่น teacherId, course-6, voucher-10"
          value={externalRef}
          onChange={(e) => setExternalRef(e.currentTarget.value)}
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
