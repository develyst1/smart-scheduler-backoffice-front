"use client";

import { useState } from "react";
import { Button, Card, Checkbox, Group, Modal, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { Plus } from "lucide-react";
import { useAddSchool, usePaymentSettings, useUpdateSchool } from "./PeopleData";
import { Foot, KvCard, PageTitle, baht, notifyOk } from "./PeopleParts";
import { fmtDate } from "./money";
import { ErrorState, LoadingState, errorMessage } from "./parts";
import { SALARY_PEOPLE_SOURCE } from "@/services/salary-people.service";
import { notifications } from "@mantine/notifications";
import { useRole } from "@/context/RoleContext";
import { STAFF_TYPES, VEHICLE_LABEL, type CommissionGroup, type PaymentSettings, type School } from "@/types/app/salary-people";

/** SALARY › Payment Setting (CEO only). Every word is Khwan's v3 wording (khwan-answers-v3 part 1, page 3), plus the REQ-5010 folds. Source: final-ui `salary/Settings.tsx`. */
export function SettingsBody({
  settings,
  live = SALARY_PEOPLE_SOURCE.schools === "api",
  onAddSchool,
  onEditSchool,
}: {
  settings: PaymentSettings;
  /** The School Distance list is the server's: Add school / Edit go through the handlers and the list is re-read. The rule cards, the commission table and «Add group» have NO route yet, so «Add group» and «Save settings» (which would save nothing) are not drawn. */
  live?: boolean;
  onAddSchool?: (name: string, km: number) => Promise<void>;
  onEditSchool?: (school: School, km: number) => Promise<void>;
}) {
  const [groups, setGroups] = useState<CommissionGroup[]>(settings.commissionGroups);
  const [schools, setSchools] = useState<School[]>(settings.schools);
  const [groupOpen, setGroupOpen] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [km, setKm] = useState("");
  const [newSchool, setNewSchool] = useState("NIS");
  const [newKm, setNewKm] = useState("18");
  const [newGroup, setNewGroup] = useState("Skate guard");
  const [newRate, setNewRate] = useState("30 ฿");

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Payment Setting"
        actions={
          // REQ-5010: «Add school» moved out of here, into the School Distance box
          live ? undefined : <Button onClick={() => notifyOk(`บันทึกการตั้งค่าแล้ว — ใช้กับรอบ ${fmtDate("2026-09-30")}–${fmtDate("2026-10-30")} เป็นต้นไป`)}>Save settings</Button>
        }
      />
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {settings.cards.map((c) => (
            <KvCard key={c.title} title={c.title} rows={c.rows} />
          ))}
        </SimpleGrid>

        <Card padding="md">
          <Group justify="space-between" mb="xs">
            <Title order={4} fz={16} fw={600}>
              Commission
            </Title>
            {!live && (
              <Button size="compact-sm" variant="light" onClick={() => setGroupOpen(true)}>
                Add group
              </Button>
            )}
          </Group>
          <Table.ScrollContainer minWidth={620}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Group</Table.Th>
                  <Table.Th ta="right">Rate</Table.Th>
                  <Table.Th>Full-time</Table.Th>
                  <Table.Th>Part-time</Table.Th>
                  <Table.Th>Freelance</Table.Th>
                  <Table.Th>STAFF</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {groups.map((g) => (
                  <Table.Tr key={g.group}>
                    <Table.Td fw={600}>{g.group}</Table.Td>
                    <Table.Td ta="right">{g.rate}</Table.Td>
                    <Table.Td>{g.ft}</Table.Td>
                    <Table.Td>{g.pt}</Table.Td>
                    <Table.Td>{g.fl}</Table.Td>
                    <Table.Td>{g.staff}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {/* Her four lines under Commission: left / right, in the Thai she wrote; the STAFF line is one long line, left-aligned. */}
          <Table verticalSpacing="xs" mt="sm">
            <Table.Tbody>
              <Table.Tr>
                <Table.Th w="22%" fw={600}>
                  Full-time
                </Table.Th>
                {/* REQ-5010: ฟลูไทม์ → ฟูลไทม์ */}
                <Table.Td>รวมค่าคอมของทั้งเดือน และหารแบ่งตามจำนวนของครูฟูลไทม์ (จ่ายสิ้นเดือน) ครูใหม่ที่เข้ามาระหว่างเดือน จะได้รับสัดส่วนเท่ากัน</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th fw={600}>Part-time · Freelance</Table.Th>
                <Table.Td>จ่ายแยกของใครของมัน</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          <Text size="sm" mt="xs">
            <b>STAFF</b> &nbsp; get commission on Skate bag sales only
          </Text>
          <Foot>*หากมีครูมากกว่า 1 คน ให้หารแบ่งเท่า ๆ กัน</Foot>
          <Foot>**หากมีส่วนลด ค่าคอมยังเท่าเดิม และสามารถปรับค่าคอมได้ด้วยในบางกรณี</Foot>
          <Foot>***หากจ่ายสด กรอก 0</Foot>
        </Card>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Card padding="md">
            <Title order={4} fz={16} fw={600} mb="xs">
              Transportation
            </Title>
            <Table.ScrollContainer minWidth={320}>
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Vehicle</Table.Th>
                    <Table.Th ta="right">Per KM</Table.Th>
                    <Table.Th ta="right">Minimum / Trip</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {settings.transport.map((t) => (
                    <Table.Tr key={t.vehicle}>
                      {/* REQ-5010: «Motorbike» → «Motorcycle» (label only; the type is still `motorbike`) */}
                      <Table.Td>{VEHICLE_LABEL[t.vehicle]}</Table.Td>
                      <Table.Td ta="right">{baht(t.perKmSatang)}</Table.Td>
                      <Table.Td ta="right">{baht(t.minimumSatang)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Foot>*One way or round trip</Foot>
            <Foot>**หากค่ารถ (ต่อเที่ยว) ที่คำนวณน้อยกว่า Minimum ให้จ่ายที่ Minimum</Foot>
          </Card>
          <Card padding="md">
            <Group justify="space-between" mb="xs" wrap="nowrap">
              <Title order={4} fz={16} fw={600}>
                School Distance
              </Title>
              {/* REQ-5010: «Add school» sits in the same box as the school list */}
              <Button size="compact-sm" variant="light" leftSection={<Plus size={14} />} onClick={() => setSchoolOpen(true)}>
                Add school
              </Button>
            </Group>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>School</Table.Th>
                  <Table.Th ta="right">One Way</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {schools.map((s) => (
                  <Table.Tr key={s.name}>
                    <Table.Td>{s.name}</Table.Td>
                    <Table.Td ta="right">{s.km} KM</Table.Td>
                    <Table.Td ta="right">
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => {
                          setEditing(s);
                          setKm(String(s.km));
                        }}
                      >
                        Edit
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Foot>*คำนวณระยะทางโดยใช้กิโลจากมอเตอร์ไซค์</Foot>
            <Foot>**หากใช้รถยนตร์ ให้เทียบกิโลเมตรอีกครั้ง</Foot>
          </Card>
        </SimpleGrid>
      </Stack>

      <Modal opened={groupOpen} onClose={() => setGroupOpen(false)} title="Add commission group" centered>
        <Stack>
          <Group grow>
            <TextInput label="Group name" value={newGroup} onChange={(e) => setNewGroup(e.currentTarget.value)} />
            <TextInput label="Rate per item" value={newRate} onChange={(e) => setNewRate(e.currentTarget.value)} />
          </Group>
          <Checkbox.Group label="Who earns it" defaultValue={["Full-time", "Part-time", "Freelance"]}>
            <Group mt="xs">
              {STAFF_TYPES.map((t) => (
                <Checkbox key={t} value={t} label={t} />
              ))}
            </Group>
          </Checkbox.Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setGroupOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const n = newGroup.trim();
                if (!n || groups.some((g) => g.group === n)) return;
                setGroups((g) => [...g, { group: n, rate: newRate.trim() || "—", ft: "Share Equally", pt: "Own", fl: "Own", staff: "—" }]);
                setGroupOpen(false);
                notifyOk(`เพิ่มกลุ่มค่าคอม “${n}” ${newRate} แล้ว — ผูกสินค้าเข้ากลุ่มได้ที่หน้า Product`);
              }}
            >
              Add group
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={schoolOpen} onClose={() => setSchoolOpen(false)} title="Add school" centered>
        <Stack>
          <Group grow>
            <TextInput label="School" value={newSchool} onChange={(e) => setNewSchool(e.currentTarget.value)} />
            <TextInput label="One Way (KM)" value={newKm} onChange={(e) => setNewKm(e.currentTarget.value)} />
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setSchoolOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const n = newSchool.trim();
                const k = Number(newKm);
                if (!n || !Number.isFinite(k) || k <= 0 || schools.some((s) => s.name === n)) return;
                if (onAddSchool) {
                  try {
                    await onAddSchool(n, k); // the list is re-read from the server on success
                  } catch (e) {
                    return void notifications.show({ color: "red", message: errorMessage(e) });
                  }
                } else setSchools((s) => [...s, { name: n, km: k }]);
                setSchoolOpen(false);
                notifyOk(`เพิ่มโรงเรียน ${n} (${k} กม.) แล้ว — ใช้คิดค่าน้ำมันตอนแอดมินบันทึกเที่ยว`);
              }}
            >
              Add school
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ""}`} centered>
        <Stack>
          <TextInput label="One Way (KM)" value={km} onChange={(e) => setKm(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const k = Number(km);
                if (!editing || !Number.isFinite(k) || k <= 0) return;
                if (onEditSchool) {
                  try {
                    await onEditSchool(editing, k);
                  } catch (e) {
                    return void notifications.show({ color: "red", message: errorMessage(e) });
                  }
                } else setSchools((s) => s.map((x) => (x.name === editing.name ? { ...x, km: k } : x)));
                notifyOk(`แก้ระยะทาง ${editing.name} เป็น ${k} กม. แล้ว`);
                setEditing(null);
              }}
            >
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

export default function Settings() {
  const role = useRole();
  const settings = usePaymentSettings(role);
  const add = useAddSchool();
  const update = useUpdateSchool();
  if (settings.isError) return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;
  if (!role || !settings.isSuccess) return <LoadingState />;
  return settings.data ? (
    <SettingsBody
      // re-seed the local list when the server's list changes
      key={settings.data.schools.map((s) => `${s.id}:${s.km}`).join(",")}
      settings={settings.data}
      onAddSchool={async (name, km) => void (await add.mutateAsync({ name, km }))}
      onEditSchool={async (school, km) => {
        if (school.id) await update.mutateAsync({ id: school.id, km });
      }}
    />
  ) : null;
}
