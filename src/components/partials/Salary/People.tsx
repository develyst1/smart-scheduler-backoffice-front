"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Checkbox, Group, Modal, Select, Stack, Table, TextInput } from "@mantine/core";
import { Plus } from "lucide-react";
import { usePeople } from "./PeopleData";
import { PageTitle, baht, notifyOk } from "./PeopleParts";
import { ErrorState, LoadingState } from "./parts";
import { useRole } from "@/context/RoleContext";
import { SALARY_PEOPLE_SOURCE } from "@/services/salary-people.service";
import { STAFF_TYPES, VEHICLES, VEHICLE_LABEL, type PersonRow } from "@/types/app/salary-people";
import type { Role } from "@/types/app/roles";

/** The Employee list's route to one profile: the name rides the URL, so a refresh or a shared link opens the same person. */
export const profileHref = (who: string) => `/salary/person?teacherId=${encodeURIComponent(who)}`;
/** The key a row opens by: the teacher id on the API, the name on the fixture. */
export const personKey = (p: PersonRow) => p.teacherId ?? p.name;

/** SALARY › Employee (CEO · Admin). The Base salary column is left out for an Admin (R0: hidden, never masked). Source: final-ui `salary/People.tsx`. */
export function PeopleBody({
  people,
  role,
  onOpen,
  canAdd = SALARY_PEOPLE_SOURCE.people === "fixture",
}: {
  people: PersonRow[];
  role: Role;
  onOpen: (key: string) => void;
  /** Adding a person has no route yet (a teacher is created in the front office): on the API the button is HIDDEN, not a toast that saves nothing. */
  canAdd?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Toth");
  const [vehicle, setVehicle] = useState<string | null>("car");
  const [types, setTypes] = useState<string[]>(["Part-time", "Freelance"]);
  const ceo = role === "ceo";
  // Hidden, never masked: a column or a button whose data the role cannot load is not drawn at all.
  const showTypes = people.some((p) => p.types);
  const showVehicle = people.some((p) => p.vehicle);
  const showMerit = people.some((p) => p.merit);
  const showOpen = showTypes; // the profile is loadable only where the list carried it (the CEO)

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Employee"
        actions={
          canAdd ? (
            // REQ-5010: «Add employee» → «Add»
            <Button leftSection={<Plus size={16} />} onClick={() => setOpen(true)}>
              Add
            </Button>
          ) : undefined
        }
      />
      <Card padding={0}>
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" style={{ tableLayout: "fixed" }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w="16%">Name</Table.Th>
                {showTypes && <Table.Th w={ceo ? "28%" : "36%"}>Type</Table.Th>}
                {showVehicle && <Table.Th w="16%">Vehicle</Table.Th>}
                {ceo && (
                  <Table.Th w="14%" ta="right">
                    Base salary
                  </Table.Th>
                )}
                {showMerit && <Table.Th w="16%">Merit</Table.Th>}
                {showOpen && <Table.Th w="10%" ta="right" />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {people.map((p) => (
                <Table.Tr key={personKey(p)} data-person-row={p.name}>
                  <Table.Td fw={600}>{p.name}</Table.Td>
                  {showTypes && (
                    <Table.Td>
                      <Group gap={6}>
                        {(p.types ?? []).map((t) => (
                          <Badge key={t} variant="light" tt="none">
                            {t}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                  )}
                  {showVehicle && <Table.Td>{p.vehicle ? VEHICLE_LABEL[p.vehicle] : "—"}</Table.Td>}
                  {ceo && (
                    <Table.Td ta="right" className="tabular-nums">
                      {p.baseSatang === undefined ? "—" : baht(p.baseSatang)}
                    </Table.Td>
                  )}
                  {showMerit && <Table.Td>{p.merit ?? "—"}</Table.Td>}
                  {showOpen && (
                    <Table.Td ta="right">
                      <Button size="compact-sm" variant="light" onClick={() => onOpen(personKey(p))}>
                        Open
                      </Button>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      <Modal opened={open} onClose={() => setOpen(false)} title="Add employee" centered>
        <Stack>
          <Group grow align="flex-start">
            <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
            {/* REQ-5010: the label reads «Motorcycle»; the value stays `motorbike` */}
            <Select
              label="Vehicle"
              data={VEHICLES.map((v) => ({ value: v, label: v === "none" ? "None" : VEHICLE_LABEL[v] }))}
              value={vehicle}
              onChange={setVehicle}
              allowDeselect={false}
            />
          </Group>
          <Checkbox.Group label="Type" value={types} onChange={setTypes}>
            <Group mt="xs">
              {STAFF_TYPES.map((t) => (
                <Checkbox key={t} value={t} label={t} />
              ))}
            </Group>
          </Checkbox.Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                notifyOk(`Employee added: ${name || "—"} — set their rate and salary on the profile page next`);
              }}
            >
              Add employee
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

export default function People() {
  const router = useRouter();
  const role = useRole();
  const people = usePeople(role);
  if (people.isError) return <ErrorState error={people.error} onRetry={() => people.refetch()} />;
  if (!role || !people.data) return <LoadingState />;
  return <PeopleBody people={people.data} role={role} onOpen={(k) => router.push(profileHref(k))} />;
}
