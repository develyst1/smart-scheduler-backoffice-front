"use client";

import { useState } from "react";
import { Badge, Button, Card, Center, Loader, SegmentedControl, Select, Text } from "@mantine/core";
import { ArrowLeftRight, Package, Pencil, Plus, Link2 } from "lucide-react";
import { useBoItems, useTagGroups } from "@/hooks/backoffice/useBo";
import {
  CADENCE_LABEL,
  DIRECTION_LABEL,
  thb,
  type BoItem,
  type Cadence,
  type Direction,
} from "@/types/app/bo";
import { BoItemModal } from "./BoItemModal";
import { BoMovementModal } from "./BoMovementModal";

type DirFilter = "ALL" | Direction;

export default function BoItemsContent() {
  const [dir, setDir] = useState<DirFilter>("ALL");
  const [cadence, setCadence] = useState<Cadence | null>(null);
  const [tagValueId, setTagValueId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<BoItem | null>(null);
  const [moveItem, setMoveItem] = useState<BoItem | null>(null);

  const tagGroups = useTagGroups().data ?? [];
  const query = useBoItems({
    direction: dir === "ALL" ? undefined : dir,
    cadence: cadence ?? undefined,
    tagValueId: tagValueId ?? undefined,
  });
  const items = query.data ?? [];

  const openCreate = () => {
    setEditItem(null);
    setModalOpen(true);
  };
  const openEdit = (it: BoItem) => {
    setEditItem(it);
    setModalOpen(true);
  };

  const tagOptions = tagGroups.flatMap((g) => g.values.map((v) => ({ value: v.id, label: `${g.name}: ${v.label}` })));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-success/70">Catalog</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">รายการ (Items)</h1>
          <p className="mt-0.5 text-sm text-default-400">
            ทุกอย่างเป็น item — รายรับ/รายจ่าย × ผันแปร/คงที่ · เคลื่อนไหวเข้า-ออกเพื่อบันทึกมูลค่า
          </p>
        </div>
        <Button leftSection={<Plus size={16} />} color="green" onClick={openCreate}>
          เพิ่ม item
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={dir}
          onChange={(v) => setDir(v as DirFilter)}
          data={[
            { value: "ALL", label: "ทั้งหมด" },
            { value: "INCOME", label: DIRECTION_LABEL.INCOME },
            { value: "EXPENSE", label: DIRECTION_LABEL.EXPENSE },
          ]}
        />
        <Select
          placeholder="รอบ (ทั้งหมด)"
          value={cadence}
          onChange={(v) => setCadence(v as Cadence | null)}
          data={(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => ({ value: c, label: CADENCE_LABEL[c] }))}
          clearable
          size="sm"
          w={170}
        />
        {tagOptions.length > 0 && (
          <Select placeholder="แท็ก (ทั้งหมด)" value={tagValueId} onChange={setTagValueId} data={tagOptions} clearable searchable size="sm" w={200} />
        )}
      </div>

      <Card padding={0} className="overflow-hidden">
        {query.isLoading ? (
          <Center h={240}><Loader color="green" /></Center>
        ) : query.isError ? (
          <Center h={240}><Text c="red" fz="sm">โหลด item ไม่สำเร็จ — ตรวจ backoffice API (พอร์ต 4010)</Text></Center>
        ) : items.length === 0 ? (
          <Center h={240}>
            <div className="text-center">
              <Package size={30} className="mx-auto text-default-400" />
              <Text c="dimmed" fz="sm" mt="sm">ยังไม่มี item ในหมวดนี้</Text>
            </div>
          </Center>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-default-200 text-left text-xs uppercase tracking-wide text-default-400">
                  <th className="px-4 py-3 font-medium">ชื่อ</th>
                  <th className="px-4 py-3 font-medium">ประเภท</th>
                  <th className="px-4 py-3 text-right font-medium">ราคา/หน่วย</th>
                  <th className="px-4 py-3 text-right font-medium">คงเหลือ / เพดาน</th>
                  <th className="px-4 py-3 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <ItemRow key={it.id} item={it} onMove={() => setMoveItem(it)} onEdit={() => openEdit(it)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Text c="dimmed" fz="xs" mt="sm">{items.length} รายการ</Text>

      <BoItemModal opened={modalOpen} item={editItem} tagGroups={tagGroups} onClose={() => setModalOpen(false)} />
      <BoMovementModal item={moveItem} onClose={() => setMoveItem(null)} />
    </div>
  );
}

function ItemRow({ item, onMove, onEdit }: { item: BoItem; onMove: () => void; onEdit: () => void }) {
  const tracks = item.ceilingQty != null;
  const low = tracks && (item.remainingQty ?? 0) <= 0;

  return (
    <tr className={`border-b border-default-100/70 transition-colors last:border-0 hover:bg-default-100/40 ${item.active ? "" : "opacity-60"}`}>
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{item.name}</div>
        {item.ownerRef && (
          <div className="inline-flex items-center gap-1 text-xs text-default-400"><Link2 size={12} /> {item.ownerRef}</div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge size="sm" variant="light" color={item.direction === "INCOME" ? "green" : "red"}>
            {DIRECTION_LABEL[item.direction]}
          </Badge>
          <Badge size="sm" variant="outline" color="gray">{CADENCE_LABEL[item.cadence]}</Badge>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-num text-foreground">{thb(item.unitPriceMinor)}</td>
      <td className="px-4 py-3 text-right">
        {tracks ? (
          <span className={`font-num ${low ? "text-danger" : "text-foreground"}`}>
            {item.remainingQty}
            <span className="text-default-400"> / {item.ceilingQty} {item.unit}</span>
          </span>
        ) : (
          <span className="text-default-400">ไม่นับสต๊อก</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button size="xs" variant="light" color="gray" leftSection={<ArrowLeftRight size={13} />} onClick={onMove}>เข้า/ออก</Button>
          <Button size="xs" variant="subtle" color="gray" leftSection={<Pencil size={13} />} onClick={onEdit}>แก้ไข</Button>
        </div>
      </td>
    </tr>
  );
}
