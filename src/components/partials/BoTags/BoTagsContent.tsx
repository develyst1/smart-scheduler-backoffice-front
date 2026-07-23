"use client";

import { useState } from "react";
import { Badge, Button, Card, Center, Loader, Modal, Stack, Text, TextInput } from "@mantine/core";
import { Plus, Tags } from "lucide-react";
import { useCreateTagGroup, useCreateTagValue, useTagGroups } from "@/hooks/backoffice/useBo";
import { ApiClientError } from "@/lib/api/client";
import { notify } from "@/lib/ui/notify";

export default function BoTagsContent() {
  const query = useTagGroups();
  const groups = query.data ?? [];
  const createGroup = useCreateTagGroup();
  const createValue = useCreateTagValue();

  const [groupModal, setGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [valueFor, setValueFor] = useState<string | null>(null); // tagGroupId
  const [valueLabel, setValueLabel] = useState("");

  const submitGroup = async () => {
    if (!groupName.trim()) return;
    try {
      await createGroup.mutateAsync({ name: groupName.trim() });
      notify({ title: "เพิ่มกลุ่มแท็กแล้ว", color: "success" });
      setGroupName("");
      setGroupModal(false);
    } catch (e) {
      notify({ title: "ผิดพลาด", description: e instanceof ApiClientError ? e.message : "ไม่สำเร็จ", color: "danger" });
    }
  };

  const submitValue = async () => {
    if (!valueFor || !valueLabel.trim()) return;
    try {
      await createValue.mutateAsync({ tagGroupId: valueFor, label: valueLabel.trim() });
      notify({ title: "เพิ่มค่าแท็กแล้ว", color: "success" });
      setValueLabel("");
      setValueFor(null);
    } catch (e) {
      notify({ title: "ผิดพลาด", description: e instanceof ApiClientError ? e.message : "ไม่สำเร็จ", color: "danger" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-success/70">Tags</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">แท็ก</h1>
          <p className="mt-0.5 text-sm text-default-400">จัดกลุ่ม item ด้วยแท็ก (1 ค่า/กลุ่ม ต่อ item)</p>
        </div>
        <Button leftSection={<Plus size={16} />} color="green" onClick={() => setGroupModal(true)}>
          เพิ่มกลุ่มแท็ก
        </Button>
      </div>

      {query.isLoading ? (
        <Center h={200}><Loader color="green" /></Center>
      ) : groups.length === 0 ? (
        <Center h={200}>
          <div className="text-center">
            <Tags size={30} className="mx-auto text-default-400" />
            <Text c="dimmed" fz="sm" mt="sm">ยังไม่มีกลุ่มแท็ก</Text>
          </div>
        </Center>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <Card key={g.id} padding="md">
              <div className="flex items-center justify-between">
                <p className="font-medium">{g.name}</p>
                <Button size="compact-xs" variant="light" color="gray" leftSection={<Plus size={12} />} onClick={() => setValueFor(g.id)}>
                  เพิ่มค่า
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {g.values.length === 0 ? (
                  <Text c="dimmed" fz="xs">ยังไม่มีค่าในกลุ่มนี้</Text>
                ) : (
                  g.values.map((v) => (
                    <Badge key={v.id} variant="light" color="gray">{v.label}</Badge>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal opened={groupModal} onClose={() => setGroupModal(false)} title="เพิ่มกลุ่มแท็ก" centered radius="lg">
        <Stack gap="md">
          <TextInput label="ชื่อกลุ่ม" placeholder="เช่น สาขา, หมวดสินค้า" value={groupName} onChange={(e) => setGroupName(e.currentTarget.value)} required />
          <Button color="green" onClick={submitGroup} loading={createGroup.isPending}>บันทึก</Button>
        </Stack>
      </Modal>

      <Modal opened={!!valueFor} onClose={() => setValueFor(null)} title="เพิ่มค่าแท็ก" centered radius="lg">
        <Stack gap="md">
          <TextInput label="ชื่อค่า" placeholder="เช่น สาขาหลัก" value={valueLabel} onChange={(e) => setValueLabel(e.currentTarget.value)} required />
          <Button color="green" onClick={submitValue} loading={createValue.isPending}>บันทึก</Button>
        </Stack>
      </Modal>
    </div>
  );
}
