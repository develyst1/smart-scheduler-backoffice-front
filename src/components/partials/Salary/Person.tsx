"use client";

import { useState } from "react";
import { Badge, Button, Card, Group, NumberInput, Select, SegmentedControl, Table } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useRouter, useSearchParams } from "next/navigation";
import { usePeople, useProfile, useSaveFlRates, useSaveProfile } from "./PeopleData";
import { KvCard, PageTitle, baht, notifyOk } from "./PeopleParts";
import { bahtInputToSatang } from "./money";
import { ErrorState, LoadingState, errorMessage } from "./parts";
import { personKey, profileHref } from "./People";
import { useRole } from "@/context/RoleContext";
import { planFlSaves } from "@/services/salary-people.service";
import { FL_CLASSES, VEHICLES, VEHICLE_LABEL, type ClassType, type FlChange, type PersonProfile, type ProfileEdit, type Vehicle } from "@/types/app/salary-people";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Whole satang → the text a baht input holds: 800000 → "8000", 800050 → "8000.50" (integer maths, no float). */
const satangToInput = (s: number): string => `${Math.floor(s / 100)}${s % 100 ? `.${String(s % 100).padStart(2, "0")}` : ""}`;

/**
 * SALARY › Employee Profile (hidden; opened from Employee). Base salary and the Freelance Rate are left out for an Admin (R0: hidden, never masked) — the data seam does not send them.
 * Source: final-ui `salary/Person.tsx`. When the profile came from the API for the CEO (`profile.raw`) and `onSave` is given, Base salary · Vehicle · Merit are editable and «Save profile» saves them (TASK-869).
 */
export function PersonBody({
  profile,
  options,
  onPick,
  onBack,
  onSave,
  saving = false,
}: {
  profile: PersonProfile;
  options: { value: string; label: string }[];
  onPick: (key: string) => void;
  onBack: () => void;
  onSave?: (edit: ProfileEdit, flChanges: FlChange[]) => void;
  saving?: boolean;
}) {
  const editable = !!profile.raw && !!onSave;
  // TASK-899 — the Freelance Rate boxes: one per class type, empty when no rate is set (never 0); only for the CEO on a person who holds the FL role.
  const flEditable = editable && !!profile.flRates;
  const initialFl = Object.fromEntries(FL_CLASSES.map((c) => [c.classType, (() => { const r = profile.flRates?.find((x) => x.classType === c.classType)?.rateSatang; return r == null ? "" : satangToInput(r); })()])) as Record<ClassType, string>;
  const [fl, setFl] = useState<Record<ClassType, string>>(initialFl);
  const flPlan = planFlSaves(initialFl, fl);
  const [base, setBase] = useState<string | number>(profile.baseSatang === undefined ? "" : satangToInput(profile.baseSatang));
  const [vehicle, setVehicle] = useState<Vehicle>(profile.vehicle ?? "none");
  const [merit, setMerit] = useState<boolean>(profile.raw?.meritEligible ?? false);
  const baseSatang = base === "" ? null : bahtInputToSatang(base);
  const baseInvalid = base !== "" && baseSatang === null;

  const rows: [React.ReactNode, React.ReactNode][] = [];
  if (profile.type !== undefined) rows.push(["Type", profile.type]);
  if (profile.baseSatang !== undefined)
    rows.push([
      "Base salary",
      editable ? (
        <NumberInput value={base} onChange={setBase} min={0} decimalScale={2} thousandSeparator="," suffix=" ฿" error={baseInvalid} aria-label="Base salary" w={180} />
      ) : (
        baht(profile.baseSatang)
      ),
    ]);
  if (flEditable)
    rows.push([
      "Freelance Rate",
      <Group gap="xs" key="fl-edit" data-fl-editor>
        {FL_CLASSES.map((c) => (
          <NumberInput
            key={c.classType}
            label={c.label}
            value={fl[c.classType]}
            onChange={(v) => setFl((s) => ({ ...s, [c.classType]: String(v) }))}
            min={0}
            decimalScale={2}
            allowNegative={false}
            suffix=" ฿/Hr"
            error={flPlan.invalid.includes(c.classType)}
            w={130}
            data-fl-input={c.classType}
          />
        ))}
      </Group>,
    ]);
  else if (profile.rates)
    rows.push([
      "Freelance Rate",
      <Group gap={6} key="rates">
        {profile.rates.map((r) => (
          <Badge key={r} variant="light" tt="none">{`${r} ฿/Hr`}</Badge>
        ))}
      </Group>,
    ]);
  rows.push([
    "Merit",
    editable ? (
      <Select data={["Yes", "No"]} value={merit ? "Yes" : "No"} onChange={(v) => setMerit(v === "Yes")} allowDeselect={false} aria-label="Merit" w={120} />
    ) : (
      profile.merit
    ),
  ]);
  if (profile.bonus !== undefined) rows.push(["Bonus", profile.bonus]);
  if (profile.commission !== undefined) rows.push(["Commission", profile.commission]);
  if (profile.vehicle !== undefined)
    rows.push([
      "Vehicle",
      editable ? (
        <Select
          data={VEHICLES.map((v) => ({ value: v, label: v === "none" ? "None" : VEHICLE_LABEL[v] }))}
          value={vehicle}
          onChange={(v) => setVehicle((v as Vehicle) ?? "none")}
          allowDeselect={false}
          aria-label="Vehicle"
          w={160}
        />
      ) : (
        VEHICLE_LABEL[profile.vehicle]
      ),
    ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Employee Profile"
        actions={
          <>
            <Button variant="default" onClick={onBack}>
              Back to Employee
            </Button>
            {/* An Admin's profile has nothing to save (a name and a merit flag): the button is drawn only where it does something. */}
            {(editable || profile.baseSatang !== undefined) && (
              <Button
                loading={saving}
                disabled={baseInvalid || flPlan.invalid.length > 0}
                onClick={() => (editable ? onSave?.({ baseSatang, vehicle, meritEligible: merit }, flPlan.changes) : notifyOk("บันทึกโปรไฟล์แล้ว"))}
              >
                Save profile
              </Button>
            )}
          </>
        }
      />
      {options.length > 1 && <SegmentedControl mb="md" value={personKeyOf(profile, options)} onChange={onPick} data={options} aria-label="Employee" />}
      <KvCard
        title={profile.name}
        aside={
          profile.type ? (
            <Badge variant="light" tt="none">
              {profile.type}
            </Badge>
          ) : undefined
        }
        rows={rows}
      />
      {profile.roleByDay && (
        <Card padding="md" mt="md">
          <Table.ScrollContainer minWidth={640}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  {DAYS.map((d) => (
                    <Table.Th key={d}>{d}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  {profile.roleByDay.map((r, i) => (
                    <Table.Td key={i}>
                      <Badge variant="light" color={r === "Part-time" ? "violet" : "blue"} tt="none">
                        {r}
                      </Badge>
                    </Table.Td>
                  ))}
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </div>
  );
}

/** The segment that is this profile: its id on the API, its name on the fixture. */
const personKeyOf = (p: PersonProfile, options: { value: string; label: string }[]): string => p.teacherId ?? options.find((o) => o.label === p.name)?.value ?? p.name;

/** The route: `/salary/person?teacherId=<teacher id>`. No `teacherId` (or one nobody has) opens the first person on the list, as the final UI opened Ton. */
export default function Person() {
  const router = useRouter();
  const role = useRole();
  const asked = useSearchParams().get("teacherId");
  const people = usePeople(role);
  const rows = people.data ?? [];
  const keys = rows.map(personKey);
  const who = asked && keys.includes(asked) ? asked : (keys[0] ?? "");
  const profile = useProfile(who, role);
  const save = useSaveProfile();
  const saveFl = useSaveFlRates();

  if (people.isError) return <ErrorState error={people.error} onRetry={() => people.refetch()} />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  if (!role || !people.data || !profile.data) return <LoadingState />;
  const p = profile.data;
  return (
    <PersonBody
      // remount on what the server holds, so a re-read after a save (or a partial failure) shows the truth, not the typed text
      key={`${who}|${p.baseSatang}|${p.vehicle}|${p.merit}|${(p.flRates ?? []).map((r) => r.rateSatang).join(",")}`}
      profile={p}
      options={rows.map((r) => ({ value: personKey(r), label: r.name }))}
      onPick={(k) => router.replace(profileHref(k))}
      onBack={() => router.push("/salary/people")}
      saving={save.isPending || saveFl.isPending}
      onSave={
        p.raw && p.teacherId
          ? (edit, flChanges) =>
              save.mutate(
                { teacherId: p.teacherId as string, raw: p.raw as NonNullable<PersonProfile["raw"]>, edit },
                {
                  onSuccess: async () => {
                    // TASK-899: then one PUT per changed rate; the card is re-read after, so it shows the truth even on a partial failure
                    const results = flChanges.length ? await saveFl.mutateAsync({ teacherId: p.teacherId as string, changes: flChanges }) : [];
                    const failed = results.filter((r) => !r.ok);
                    if (!failed.length) notifyOk("บันทึกโปรไฟล์แล้ว");
                    for (const f of failed) notifications.show({ color: "red", message: `${FL_CLASSES.find((c) => c.classType === f.classType)?.label}: ${f.message}` });
                  },
                  // the server's own sentence (e.g. a 400), unchanged
                  onError: (e) => notifications.show({ color: "red", message: errorMessage(e) }),
                },
              )
          : undefined
      }
    />
  );
}
