"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, Center, Loader, Text } from "@mantine/core";
import { Banknote, History, Link2, Pencil, Plus } from "lucide-react";
import { currentOf, useRecurringCosts } from "@/hooks/backoffice/useRecurring";
import type { RecurringCost } from "@/services/recurring.service";
import { thb } from "@/types/app/backoffice";
import { SetSalaryModal, type SalaryPreset } from "./SetSalaryModal";

const TYPE_LABEL: Record<string, string> = {
  FULL_TIME: "ประจำ",
  PART_TIME: "พาร์ทไทม์",
};
const monthOf = (isoDate: string) => isoDate.slice(0, 7); // "YYYY-MM-DD" → "YYYY-MM"
const typeLabel = (t: string | null) => (t ? (TYPE_LABEL[t] ?? t) : "—");

interface TeacherSalary {
  key: string;
  history: RecurringCost[]; // newest effectiveFrom first
  current: RecurringCost;
}

export default function FtptSalaryContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const [preset, setPreset] = useState<SalaryPreset | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useRecurringCosts();
  const items = query.data ?? [];

  const teachers = useMemo<TeacherSalary[]>(() => {
    const map = new Map<string, RecurringCost[]>();
    for (const rc of items) {
      const key = rc.externalRef ?? rc.itemId;
      const list = map.get(key);
      if (list) list.push(rc);
      else map.set(key, [rc]);
    }
    return [...map.entries()].map(([key, history]) => ({ key, history, current: currentOf(history) }));
  }, [items]);

  const openCreate = () => {
    setPreset(null);
    setModalOpen(true);
  };
  const openChange = (current: RecurringCost) => {
    setPreset({
      externalRef: current.externalRef ?? "",
      label: current.label,
      teacherType: current.teacherType,
    });
    setModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-success/70">Payroll</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">เงินเดือนครูประจำ / พาร์ทไทม์</h1>
          <p className="mt-0.5 text-sm text-default-400">
            ตั้งเงินเดือนครั้งเดียว · ระบบลงเป็นค่าใช้จ่ายคงที่ทุกเดือนอัตโนมัติ · แก้ไขแบบมีผลตามเดือน (ไม่แก้อดีต)
          </p>
        </div>
        <Button leftSection={<Plus size={16} />} color="green" onClick={openCreate}>
          ตั้งเงินเดือนครู
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
              โหลดเงินเดือนไม่สำเร็จ — ตรวจ Finance API พอร์ต 3002
            </Text>
          </Center>
        ) : teachers.length === 0 ? (
          <Center h={240}>
            <div className="text-center">
              <Banknote size={30} className="mx-auto text-default-400" />
              <Text c="dimmed" fz="sm" mt="sm">
                ยังไม่มีเงินเดือนครูประจำ/พาร์ทไทม์ — กด “ตั้งเงินเดือนครู”
              </Text>
            </div>
          </Center>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-default-200 text-left text-xs uppercase tracking-wide text-default-400">
                  <th className="px-4 py-3 font-medium">ครู</th>
                  <th className="px-4 py-3 font-medium">ประเภท</th>
                  <th className="px-4 py-3 text-right font-medium">เงินเดือนปัจจุบัน</th>
                  <th className="px-4 py-3 font-medium">มีผลตั้งแต่</th>
                  <th className="px-4 py-3 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((ts) => (
                  <SalaryRows
                    key={ts.key}
                    teacher={ts}
                    expanded={expanded === ts.key}
                    onToggle={() => setExpanded(expanded === ts.key ? null : ts.key)}
                    onChange={() => openChange(ts.current)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Text c="dimmed" fz="xs" mt="sm">
        {teachers.length} ครู
      </Text>

      <SetSalaryModal opened={modalOpen} preset={preset} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function SalaryRows({
  teacher,
  expanded,
  onToggle,
  onChange,
}: {
  teacher: TeacherSalary;
  expanded: boolean;
  onToggle: () => void;
  onChange: () => void;
}) {
  const { current, history } = teacher;
  const hasHistory = history.length > 1;

  return (
    <>
      <tr className="border-b border-default-100/70 transition-colors hover:bg-default-100/40">
        <td className="px-4 py-3">
          <div className="font-medium text-foreground">{current.label ?? current.externalRef}</div>
          {current.externalRef && (
            <div className="inline-flex items-center gap-1 text-xs text-default-400">
              <Link2 size={12} /> {current.externalRef}
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <Badge size="sm" variant="light" color={current.teacherType === "PART_TIME" ? "cyan" : "grape"}>
            {typeLabel(current.teacherType)}
          </Badge>
        </td>
        <td className="px-4 py-3 text-right font-num text-foreground">{thb(current.amountMinor)}</td>
        <td className="px-4 py-3 text-default-500">{monthOf(current.effectiveFrom)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            {hasHistory && (
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<History size={13} />}
                onClick={onToggle}
              >
                ประวัติ ({history.length})
              </Button>
            )}
            <Button size="xs" variant="light" color="gray" leftSection={<Pencil size={13} />} onClick={onChange}>
              ปรับเงินเดือน
            </Button>
          </div>
        </td>
      </tr>
      {expanded &&
        history.map((rc) => (
          <tr key={rc.id} className="border-b border-default-100/50 bg-default-50/40 text-xs">
            <td className="px-4 py-2 pl-10 text-default-400" colSpan={2}>
              {monthOf(rc.effectiveFrom)} → {rc.effectiveTo ? monthOf(rc.effectiveTo) : "ปัจจุบัน"}
            </td>
            <td className="px-4 py-2 text-right font-num text-default-500">{thb(rc.amountMinor)}</td>
            <td className="px-4 py-2" colSpan={2}>
              {rc.effectiveTo === null && (
                <Badge size="xs" variant="light" color="green">
                  ใช้อยู่
                </Badge>
              )}
            </td>
          </tr>
        ))}
    </>
  );
}
