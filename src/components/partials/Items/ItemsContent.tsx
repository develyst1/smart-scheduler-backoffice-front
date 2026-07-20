"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, Center, Loader, SegmentedControl, Text } from "@mantine/core";
import { ArrowLeftRight, Link2, Package, Plus } from "lucide-react";
import { useItems } from "@/hooks/backoffice/useCatalog";
import {
  ITEM_GROUP_LABEL,
  ITEM_TYPE_LABEL,
  thb,
  type CatalogItem,
  type ItemType,
} from "@/types/app/backoffice";
import { CreateItemModal } from "./CreateItemModal";
import { MovementModal } from "./MovementModal";

type Filter = "ALL" | ItemType;

const TYPE_BADGE: Record<ItemType, string> = {
  INCOME: "green",
  EXPENSE: "red",
  FIXED_COST: "orange",
};

export default function ItemsContent() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<CatalogItem | null>(null);

  const query = useItems(filter === "ALL" ? undefined : filter);
  const items = query.data ?? [];

  const counts = useMemo(() => items.length, [items]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-success/70">Catalog</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">รายการ (Items)</h1>
          <p className="mt-0.5 text-sm text-default-400">
            สินค้า · บริการ · รายรับ · รายจ่าย · ค่าใช้จ่ายคงที่ — ทุกอย่างเป็น item
          </p>
        </div>
        <Button leftSection={<Plus size={16} />} color="green" onClick={() => setCreateOpen(true)}>
          เพิ่ม item
        </Button>
      </div>

      {/* ── Filter ── */}
      <SegmentedControl
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        data={[
          { value: "ALL", label: "ทั้งหมด" },
          { value: "INCOME", label: ITEM_TYPE_LABEL.INCOME },
          { value: "EXPENSE", label: ITEM_TYPE_LABEL.EXPENSE },
          { value: "FIXED_COST", label: ITEM_TYPE_LABEL.FIXED_COST },
        ]}
        mb="md"
      />

      <Card padding={0} className="overflow-hidden">
        {query.isLoading ? (
          <Center h={240}>
            <Loader color="green" />
          </Center>
        ) : query.isError ? (
          <Center h={240}>
            <Text c="red" fz="sm">
              โหลด item ไม่สำเร็จ — ตรวจ Finance API พอร์ต 3002
            </Text>
          </Center>
        ) : items.length === 0 ? (
          <Center h={240}>
            <div className="text-center">
              <Package size={30} className="mx-auto text-default-400" />
              <Text c="dimmed" fz="sm" mt="sm">
                ยังไม่มี item ในหมวดนี้
              </Text>
            </div>
          </Center>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-default-200 text-left text-xs uppercase tracking-wide text-default-400">
                  <th className="px-4 py-3 font-medium">ชื่อ / SKU</th>
                  <th className="px-4 py-3 font-medium">ประเภท</th>
                  <th className="px-4 py-3 text-right font-medium">ราคา/หน่วย</th>
                  <th className="px-4 py-3 text-right font-medium">คงเหลือ</th>
                  <th className="px-4 py-3 font-medium">เชื่อมต่อ</th>
                  <th className="px-4 py-3 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <ItemRow key={it.id} item={it} onMove={() => setMoveItem(it)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Text c="dimmed" fz="xs" mt="sm">
        {counts} รายการ
      </Text>

      <CreateItemModal opened={createOpen} onClose={() => setCreateOpen(false)} />
      <MovementModal item={moveItem} onClose={() => setMoveItem(null)} />
    </div>
  );
}

function ItemRow({ item, onMove }: { item: CatalogItem; onMove: () => void }) {
  const low =
    item.trackStock &&
    item.reorderLevel != null &&
    item.quantityOnHand <= item.reorderLevel;

  return (
    <tr className="border-b border-default-100/70 transition-colors last:border-0 hover:bg-default-100/40">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{item.name}</div>
        <div className="text-xs text-default-400">{item.sku}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge size="sm" variant="light" color={TYPE_BADGE[item.itemType]}>
            {ITEM_TYPE_LABEL[item.itemType]}
          </Badge>
          <Badge size="sm" variant="outline" color="gray">
            {ITEM_GROUP_LABEL[item.itemGroup]}
          </Badge>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-num text-foreground">{thb(item.salePriceMinor)}</td>
      <td className="px-4 py-3 text-right">
        {item.trackStock ? (
          <span className={`font-num ${low ? "text-warning" : "text-foreground"}`}>
            {item.quantityOnHand}
            <span className="ml-1 text-xs text-default-400">{item.unit}</span>
          </span>
        ) : (
          <span className="text-default-400">ไม่นับสต๊อก</span>
        )}
      </td>
      <td className="px-4 py-3">
        {item.externalRef ? (
          <span className="inline-flex items-center gap-1 text-xs text-default-400">
            <Link2 size={12} /> {item.externalRef}
          </span>
        ) : (
          <span className="text-default-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          size="xs"
          variant="light"
          color="gray"
          leftSection={<ArrowLeftRight size={13} />}
          onClick={onMove}
        >
          เข้า/ออก
        </Button>
      </td>
    </tr>
  );
}
