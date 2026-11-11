"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Group, NumberInput, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useRole } from "@/context/RoleContext";
import { notifications } from "@mantine/notifications";
import { useCreateEntry, useCreateTrip, useEntryPeople, useTransportSchools } from "./hooks";
import { tripWord } from "./entries-logic";
import MonthPicker from "./MonthPicker";
import { bahtInputToSatang, currentYearMonth, fmtDate, formatBaht, formatSigned, payRangeOf } from "./money";
import { ErrorState, LoadingState, errorMessage } from "./parts";
import type { EntryLine, TripEntry } from "@/types/app/salary";

export interface TripDetailRow {
  /** the name picked on the form */
  person: string;
  trip: TripEntry;
}

/** The trips THIS admin entered in this visit: school · date · trip · km. Admin-blind: it reads those keys by name, so no amount or vehicle can get in. */
export function TripDetailTable({ rows }: { rows: TripDetailRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Table.ScrollContainer minWidth={520}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Person</Table.Th>
            <Table.Th>School</Table.Th>
            <Table.Th>Trip</Table.Th>
            <Table.Th ta="right">km</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody data-trip-rows>
          {rows.map((r) => (
            <Table.Tr key={r.trip.id} data-trip-row>
              <Table.Td className="tabular-nums">{fmtDate(r.trip.date)}</Table.Td>
              <Table.Td>{r.person}</Table.Td>
              <Table.Td>{r.trip.schoolName}</Table.Td>
              <Table.Td>{tripWord(r.trip.roundTrip)}</Table.Td>
              <Table.Td ta="right" className="tabular-nums">
                {r.trip.km}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

export interface EntryDetailRow {
  /** dd/mm/yy the line was entered */
  date: string;
  /** the name picked on the form — the create response does not carry it */
  person: string;
  line: EntryLine;
}

/**
 * The "Detail" list: what THIS admin entered, from the 201 responses. Admin-blind: it renders ONLY the typed line's own
 * kind label / text / amount. It reads those three keys by name, so any other field a response carried (a total, a base) has no way in.
 */
export function EntryDetailTable({ rows }: { rows: EntryDetailRow[] }) {
  return (
    <Table.ScrollContainer minWidth={520}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date</Table.Th>
            <Table.Th>Person</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody data-entry-rows>
          {rows.map((r) => (
            <Table.Tr key={r.line.lineId} data-entry-row>
              <Table.Td className="tabular-nums">{r.date}</Table.Td>
              <Table.Td>{r.person}</Table.Td>
              <Table.Td>
                {r.line.kindLabel} · {r.line.label}
              </Table.Td>
              <Table.Td ta="right" className="tabular-nums">
                {formatSigned(r.line.amountSatang)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

const card = (title: string, body: React.ReactNode, action: React.ReactNode) => (
  <Card padding="md">
    <Title order={4} fz={16} fw={600} mb="sm">
      {title}
    </Title>
    <Stack gap="sm">
      {body}
      <Group>{action}</Group>
    </Stack>
  </Card>
);

/** SALARY › Other Income. R0.3: an admin sees back only the line they typed — never a slip total, the base or a rate (SPEC-102 §5-E2). */
/**
 * TASK-933 (D-150-1, Porter 21:24): the CEO is never shown a form that refuses. Other Income (the admin's blind entry form) is not in the CEO's menu, but a typed address can bring her here:
 * she gets one pointer to where she adds lines herself — the coach's slip on the Pay run. PENDING (Porter): the sentence and «Open Pay run».
 */
export function EntriesCeoPointer() {
  return (
    <div className="mx-auto max-w-3xl" data-entries-ceo-pointer>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-foreground">Other Income</h1>
      <Card padding="lg">
        <Stack gap="sm" align="flex-start">
          <Text>Add income lines for a coach on the Payment Detail (slip)</Text>
          <Button component={Link} href="/salary/payrun" variant="light">
            Open Pay run
          </Button>
        </Stack>
      </Card>
    </div>
  );
}

/** Other Income: the admin's entry form; the CEO gets the pointer instead (no request is made for her). */
export default function Entries() {
  const role = useRole();
  if (role === "ceo") return <EntriesCeoPointer />;
  return <EntriesForm />;
}

function EntriesForm() {
  const [ym, setYm] = useState(currentYearMonth);
  const people = useEntryPeople();
  const create = useCreateEntry();
  const [rows, setRows] = useState<EntryDetailRow[]>([]);

  const [meritPerson, setMeritPerson] = useState<string | null>(null);
  const [meritAmount, setMeritAmount] = useState<string | number>("");
  const [otherPerson, setOtherPerson] = useState<string | null>(null);
  const [otherAmount, setOtherAmount] = useState<string | number>("");
  const [otherReason, setOtherReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const schools = useTransportSchools();
  const createTrip = useCreateTrip();
  const [tripRows, setTripRows] = useState<TripDetailRow[]>([]);
  const [tripPerson, setTripPerson] = useState<string | null>(null);
  const [tripDate, setTripDate] = useState("");
  const [tripSchool, setTripSchool] = useState<string | null>(null);
  const [tripType, setTripType] = useState<string | null>("round");

  const all = useMemo(() => (people.data ?? []).map((p) => ({ value: p.teacherId, label: p.name })), [people.data]);
  const meritOnly = useMemo(
    () => (people.data ?? []).filter((p) => p.meritEligible !== false).map((p) => ({ value: p.teacherId, label: p.name })),
    [people.data],
  );
  const nameOf = (id: string) => all.find((o) => o.value === id)?.label ?? "";
  const period = payRangeOf(ym.year, ym.month);

  const send = (kind: "merit" | "other", teacherId: string, amountSatang: number, reason: string | undefined) =>
    create.mutate(
      { teacherId, year: ym.year, month: ym.month, kind, amountSatang, ...(reason ? { reason } : {}) },
      {
        onSuccess: (line) => {
          setRows((r) => [{ date: fmtDate(new Date()), person: nameOf(teacherId), line }, ...r]);
          notifications.show({
            color: "green",
            message:
              kind === "merit"
                ? `Saved: Merit for ${nameOf(teacherId)} ${formatBaht(amountSatang)} ฿ → added to the slip of pay period ${period}`
                : `Saved: add / deduct ${formatSigned(amountSatang)} ฿ for ${nameOf(teacherId)}, reason “${reason}” → added to the slip of pay period ${period}`,
          });
          if (kind === "merit") setMeritAmount("");
          else {
            setOtherAmount("");
            setOtherReason("");
          }
        },
        // the server's own sentence (400 kind not allowed · 422 not merit-eligible · 409 locked · …)
        onError: (e) => notifications.show({ color: "red", message: errorMessage(e) }),
      },
    );

  const saveMerit = () => {
    const next: Record<string, string> = {};
    const s = meritAmount === "" ? null : bahtInputToSatang(meritAmount);
    if (!meritPerson) next.meritPerson = "Required";
    if (s === null || s <= 0) next.meritAmount = "Required";
    setErrors(next);
    if (Object.keys(next).length || !meritPerson || s === null) return;
    send("merit", meritPerson, s, undefined);
  };

  const saveOther = () => {
    const next: Record<string, string> = {};
    const s = otherAmount === "" ? null : bahtInputToSatang(otherAmount);
    if (!otherPerson) next.otherPerson = "Required";
    if (s === null || s === 0) next.otherAmount = "Required";
    if (!otherReason.trim()) next.otherReason = "Required";
    setErrors(next);
    if (!otherReason.trim()) {
      notifications.show({ color: "orange", message: "A reason is required before saving an add / deduct line" });
    }
    if (Object.keys(next).length || !otherPerson || s === null) return;
    send("other", otherPerson, s, otherReason.trim());
  };

  const schoolOptions = useMemo(
    () => (schools.data ?? []).map((s) => ({ value: s.id, label: `${s.name} · ${s.distanceKm} km` })),
    [schools.data],
  );

  const saveTrip = () => {
    const next: Record<string, string> = {};
    if (!tripPerson) next.tripPerson = "Required";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tripDate)) next.tripDate = "Required";
    if (!tripSchool) next.tripSchool = "Required";
    setErrors(next);
    if (Object.keys(next).length || !tripPerson || !tripSchool) return;
    const roundTrip = tripType !== "one";
    const schoolName = (schools.data ?? []).find((s) => s.id === tripSchool)?.name ?? "";
    createTrip.mutate(
      { teacherId: tripPerson, date: tripDate, schoolId: tripSchool, roundTrip },
      {
        onSuccess: (trip) => {
          setTripRows((r) => [{ person: nameOf(tripPerson), trip }, ...r]);
          notifications.show({
            color: "green",
            message: `Saved: fuel cost for 1 trip, ${nameOf(tripPerson)} ${fmtDate(tripDate)} ${trip.schoolName || schoolName} ${tripWord(roundTrip)} → added to the slip of pay period ${period}`,
          });
        },
        // the server's own sentence (409 locked · 400 inactive school / bad input · 404)
        onError: (e) => notifications.show({ color: "red", message: errorMessage(e) }),
      },
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-foreground">Other Income</h1>
      <Group mb="md">
        <MonthPicker year={ym.year} month={ym.month} onChange={setYm} />
      </Group>

      {people.isLoading ? (
        <LoadingState />
      ) : people.isError ? (
        <ErrorState error={people.error} onRetry={() => people.refetch()} />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
          {card(
            "Merit",
            <>
              <Select
                label="Person"
                data={meritOnly}
                value={meritPerson}
                onChange={setMeritPerson}
                error={errors.meritPerson}
                allowDeselect={false}
                searchable
                data-picker="merit"
              />
              <NumberInput
                label="Amount"
                value={meritAmount}
                onChange={setMeritAmount}
                error={errors.meritAmount}
                decimalScale={2}
                thousandSeparator=","
                suffix=" ฿"
                min={0}
              />
            </>,
            <Button loading={create.isPending} onClick={saveMerit} data-save="merit">
              Save
            </Button>,
          )}
          {card(
            "Other ±",
            <>
              <Select
                label="Person"
                data={all}
                value={otherPerson}
                onChange={setOtherPerson}
                error={errors.otherPerson}
                allowDeselect={false}
                searchable
                data-picker="other"
              />
              <NumberInput
                label="Amount"
                value={otherAmount}
                onChange={setOtherAmount}
                error={errors.otherAmount}
                allowNegative
                decimalScale={2}
                thousandSeparator=","
                suffix=" ฿"
              />
              <TextInput
                label="Reason"
                required
                placeholder="Required"
                value={otherReason}
                onChange={(e) => setOtherReason(e.currentTarget.value)}
                error={errors.otherReason}
                maxLength={500}
              />
            </>,
            <Button loading={create.isPending} onClick={saveOther} data-save="other">
              Save
            </Button>,
          )}
          {card(
            "Transportation trip",
            <>
              <Select
                label="Person"
                data={all}
                value={tripPerson}
                onChange={setTripPerson}
                error={errors.tripPerson}
                allowDeselect={false}
                searchable
                data-picker="trip"
              />
              <TextInput
                label="Date"
                type="date"
                value={tripDate}
                onChange={(e) => setTripDate(e.currentTarget.value)}
                error={errors.tripDate}
                data-trip-date
              />
              <Select
                label="School"
                data={schoolOptions}
                value={tripSchool}
                onChange={setTripSchool}
                error={errors.tripSchool ?? (schools.isError ? errorMessage(schools.error) : undefined)}
                allowDeselect={false}
                searchable
                data-picker="school"
              />
              <Select
                label="Trip"
                data={[
                  { value: "round", label: tripWord(true) },
                  { value: "one", label: tripWord(false) },
                ]}
                value={tripType}
                onChange={setTripType}
                allowDeselect={false}
                data-picker="trip-type"
              />
            </>,
            <Button loading={createTrip.isPending} onClick={saveTrip} data-save="trip">
              Save
            </Button>,
          )}
        </SimpleGrid>
      )}

      <Card padding="md">
        <Title order={4} fz={16} fw={600} mb="xs">
          Detail
        </Title>
        <EntryDetailTable rows={rows} />
        <TripDetailTable rows={tripRows} />
      </Card>
    </div>
  );
}
