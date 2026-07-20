"use client";

import { useState } from "react";
import { Badge, Button, Card, Center, Loader, Progress, Text } from "@mantine/core";
import { Link2, Pencil, Plus, Wallet } from "lucide-react";
import { budgetMinorOf, useFreelanceBudgets } from "@/hooks/backoffice/useFreelanceBudgets";
import { thb, type CatalogItem } from "@/types/app/backoffice";
import { CreateFreelanceBudgetModal } from "./CreateFreelanceBudgetModal";
import { EditFreelanceBudgetModal } from "./EditFreelanceBudgetModal";
import { TopUpModal } from "./TopUpModal";

export default function FreelanceBudgetsContent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [topUpItem, setTopUpItem] = useState<CatalogItem | null>(null);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);

  const query = useFreelanceBudgets();
  const items = query.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-success/70">Payroll</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">งบครูฟรีแลนซ์</h1>
          <p className="mt-0.5 text-sm text-default-400">
            งบรายเดือนต่อครู (บาท) · ตัดตอนจองงาน · ครบงบแล้วระบบซ่อนครูจากการจองอัตโนมัติ
          </p>
        </div>
        <Button leftSection={<Plus size={16} />} color="green" onClick={() => setCreateOpen(true)}>
          เพิ่มงบครู
        </Button>
      </div>

      <Card padding={0} className="overflow-hidden">
        {query.isLoading ? (
          <Center h={240}>
            <Loader color="green" />
          </Center>
        ) : query.isError ? (
          <Center h={240}>
            <Text c="red" fz="sm">
              โหลดงบครูไม่สำเร็จ — ตรวจ Finance API พอร์ต 3002
            </Text>
          </Center>
        ) : items.length === 0 ? (
          <Center h={240}>
            <div className="text-center">
              <Wallet size={30} className="mx-auto text-default-400" />
              <Text c="dimmed" fz="sm" mt="sm">
                ยังไม่มีงบครูฟรีแลนซ์ — กด “เพิ่มงบครู”
              </Text>
            </div>
          </Center>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-default-200 text-left text-xs uppercase tracking-wide text-default-400">
                  <th className="px-4 py-3 font-medium">ครู</th>
                  <th className="px-4 py-3 text-right font-medium">เรต/ชม.</th>
                  <th className="px-4 py-3 font-medium">งบคงเหลือ / งบเดือน</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                  <th className="px-4 py-3 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <BudgetRow
                    key={it.id}
                    item={it}
                    onTopUp={() => setTopUpItem(it)}
                    onEdit={() => setEditItem(it)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Text c="dimmed" fz="xs" mt="sm">
        {items.length} ครู
      </Text>

      <CreateFreelanceBudgetModal opened={createOpen} onClose={() => setCreateOpen(false)} />
      <EditFreelanceBudgetModal item={editItem} onClose={() => setEditItem(null)} />
      <TopUpModal item={topUpItem} onClose={() => setTopUpItem(null)} />
    </div>
  );
}

function BudgetRow({
  item,
  onTopUp,
  onEdit,
}: {
  item: CatalogItem;
  onTopUp: () => void;
  onEdit: () => void;
}) {
  const remaining = item.quantityOnHand;
  const budget = budgetMinorOf(item);
  const capped = remaining <= 0;
  const nearCap =
    !capped && item.reorderLevel != null && remaining <= item.reorderLevel;

  const pct = budget > 0 ? Math.min(100, Math.max(0, (remaining / budget) * 100)) : 0;
  const barColor = capped ? "red" : nearCap ? "orange" : "green";

  return (
    <tr className="border-b border-default-100/70 transition-colors last:border-0 hover:bg-default-100/40">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{item.name}</div>
        {item.externalRef && (
          <div className="inline-flex items-center gap-1 text-xs text-default-400">
            <Link2 size={12} /> {item.externalRef}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right font-num text-foreground">{thb(item.salePriceMinor)}</td>
      <td className="px-4 py-3">
        <div className="min-w-[180px]">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className={`font-num ${capped ? "text-danger" : nearCap ? "text-warning" : "text-foreground"}`}>
              {thb(remaining)}
            </span>
            <span className="text-xs text-default-400">/ {thb(budget)}</span>
          </div>
          <Progress size="md" radius="xl" value={pct} color={barColor} />
        </div>
      </td>
      <td className="px-4 py-3">
        {capped ? (
          <Badge size="sm" variant="light" color="red">
            เต็มงบ (ถูกซ่อน)
          </Badge>
        ) : nearCap ? (
          <Badge size="sm" variant="light" color="orange">
            ใกล้เต็มงบ
          </Badge>
        ) : (
          <Badge size="sm" variant="light" color="green">
            ปกติ
          </Badge>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Button size="xs" variant="light" color="gray" leftSection={<Plus size={13} />} onClick={onTopUp}>
            เติมงบ
          </Button>
          <Button size="xs" variant="subtle" color="gray" leftSection={<Pencil size={13} />} onClick={onEdit}>
            แก้ไข
          </Button>
        </div>
      </td>
    </tr>
  );
}
