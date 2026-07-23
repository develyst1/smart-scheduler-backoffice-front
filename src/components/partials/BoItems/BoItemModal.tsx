"use client";

import { useEffect, useState } from "react";
import { Button, Group, Modal, MultiSelect, NumberInput, Select, Stack, Switch, TextInput } from "@mantine/core";
import { useCreateBoItem, useSetItemTags, useUpdateBoItem } from "@/hooks/backoffice/useBo";
import { ApiClientError } from "@/lib/api/client";
import { notify } from "@/lib/ui/notify";
import {
  CADENCE_LABEL,
  DIRECTION_LABEL,
  type BoItem,
  type Cadence,
  type Direction,
  type TagGroup,
} from "@/types/app/bo";

const toSatang = (baht: number | string) => Math.round(Number(baht) * 100);

export function BoItemModal({
  opened,
  item,
  tagGroups,
  onClose,
}: {
  opened: boolean;
  item: BoItem | null;
  tagGroups: TagGroup[];
  onClose: () => void;
}) {
  const create = useCreateBoItem();
  const update = useUpdateBoItem();
  const setTags = useSetItemTags();
  const isEdit = !!item;

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("ชิ้น");
  const [direction, setDirection] = useState<Direction>("INCOME");
  const [cadence, setCadence] = useState<Cadence>("VARIABLE");
  const [price, setPrice] = useState<number | string>(0);
  const [ceiling, setCeiling] = useState<number | string>("");
  const [ownerRef, setOwnerRef] = useState("");
  const [active, setActive] = useState(true);
  const [tagValueIds, setTagValueIds] = useState<string[]>([]);

  useEffect(() => {
    if (!opened) return;
    setName(item?.name ?? "");
    setUnit(item?.unit ?? "ชิ้น");
    setDirection(item?.direction ?? "INCOME");
    setCadence(item?.cadence ?? "VARIABLE");
    setPrice(item ? item.unitPriceMinor / 100 : 0);
    setCeiling(item?.ceilingQty != null ? item.ceilingQty : "");
    setOwnerRef(item?.ownerRef ?? "");
    setActive(item?.active ?? true);
    setTagValueIds([]); // item DTO doesn't carry tags — see TASK-023 Questions
  }, [opened, item]);

  const tagOptions = tagGroups.flatMap((g) =>
    g.values.map((v) => ({ value: v.id, label: `${g.name}: ${v.label}` })),
  );

  const ceilingQty = ceiling === "" ? null : Math.round(Number(ceiling));

  const submit = async () => {
    if (!name.trim()) {
      notify({ title: "กรอกชื่อ item ก่อน", color: "warning" });
      return;
    }
    try {
      if (isEdit && item) {
        await update.mutateAsync({
          id: item.id,
          patch: {
            name: name.trim(),
            unitPriceMinor: toSatang(price),
            ceilingQty,
            cadence,
            active,
          },
        });
        if (tagValueIds.length) await setTags.mutateAsync({ itemId: item.id, tagValueIds });
      } else {
        await create.mutateAsync({
          name: name.trim(),
          unit: unit.trim() || "ชิ้น",
          direction,
          cadence,
          unitPriceMinor: toSatang(price),
          ceilingQty,
          ownerRef: ownerRef.trim() || undefined,
        });
      }
      notify({ title: isEdit ? "แก้ไข item แล้ว" : "เพิ่ม item แล้ว", description: name, color: "success" });
      onClose();
    } catch (e) {
      notify({ title: "ผิดพลาด", description: e instanceof ApiClientError ? e.message : "บันทึกไม่สำเร็จ", color: "danger" });
    }
  };

  const busy = create.isPending || update.isPending || setTags.isPending;

  return (
    <Modal opened={opened} onClose={onClose} title={isEdit ? "แก้ไข item" : "เพิ่ม item ใหม่"} centered radius="lg" size="lg">
      <Stack gap="md">
        <Group grow>
          <TextInput label="ชื่อ" placeholder="เช่น น้ำดื่ม / ค่าเช่า / ครูมาร์ค" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          <TextInput label="หน่วยนับ" placeholder="ขวด / ชม. / เดือน" value={unit} onChange={(e) => setUnit(e.currentTarget.value)} disabled={isEdit} />
        </Group>
        <Group grow>
          <Select
            label="ทิศทาง (แก้ไม่ได้ภายหลัง)"
            value={direction}
            onChange={(v) => setDirection((v as Direction) ?? "INCOME")}
            data={(Object.keys(DIRECTION_LABEL) as Direction[]).map((d) => ({ value: d, label: DIRECTION_LABEL[d] }))}
            allowDeselect={false}
            disabled={isEdit}
          />
          <Select
            label="รอบ"
            value={cadence}
            onChange={(v) => setCadence((v as Cadence) ?? "VARIABLE")}
            data={(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => ({ value: c, label: CADENCE_LABEL[c] }))}
            allowDeselect={false}
          />
        </Group>
        <Group grow>
          <NumberInput label="ราคา/ต้นทุน ต่อหน่วย (บาท)" value={price} onChange={setPrice} min={0} thousandSeparator="," leftSection={<span className="text-xs text-default-400">฿</span>} />
          <NumberInput label="เพดานสต๊อก (ceiling) — ไม่บังคับ" description="ตั้งไว้ = นับคงเหลือ" value={ceiling} onChange={setCeiling} min={0} />
        </Group>
        {!isEdit && (
          <TextInput label="ผูกกับ (owner ref) — ไม่บังคับ" placeholder="เช่น teacherId" value={ownerRef} onChange={(e) => setOwnerRef(e.currentTarget.value)} />
        )}
        {isEdit && (
          <>
            <Switch label="ใช้งาน (active)" checked={active} onChange={(e) => setActive(e.currentTarget.checked)} color="green" />
            {tagOptions.length > 0 && (
              <MultiSelect label="แท็ก" description="ตั้งค่าแท็กของ item (แทนที่ค่าเดิม)" data={tagOptions} value={tagValueIds} onChange={setTagValueIds} searchable clearable />
            )}
          </>
        )}
        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>ยกเลิก</Button>
          <Button color="green" onClick={submit} loading={busy}>บันทึก</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
