"use client";

import { useState } from "react";
import { Badge, Button, Card, Group, Select, Table, Text, TextInput } from "@mantine/core";
import { Download } from "lucide-react";
import dayjs from "dayjs";
import { useCourses, useStudents } from "./hooks";
import { STATUS_OPTIONS } from "./labels";
import { ddmmyy, studentsCsv } from "./csv";
import { EmptyState, ErrorState, LoadingState } from "@/components/partials/RevenueLedger/parts";
import { todayBangkok } from "@/components/partials/RevenueLedger/labels";
import type { StudentRow, StudentStatusFilter, StudentsResult } from "@/types/app/reports";

const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : String(v));

/** The register: Name · Nickname · Age · Gender · Parent · Phone · Province · Activities · Live courses · First seen · Last attended. No money. */
export function StudentTable({ rows }: { rows: StudentRow[] }) {
  if (rows.length === 0) return <EmptyState>No data for this period</EmptyState>;
  return (
    <Table.ScrollContainer minWidth={1000}>
      <Table verticalSpacing="xs" horizontalSpacing="md" data-student-table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>NAME</Table.Th>
            <Table.Th>NICKNAME</Table.Th>
            <Table.Th ta="right">AGE</Table.Th>
            <Table.Th>GENDER</Table.Th>
            <Table.Th>PARENT</Table.Th>
            <Table.Th>PHONE</Table.Th>
            <Table.Th>PROVINCE</Table.Th>
            <Table.Th>ACTIVITIES</Table.Th>
            <Table.Th ta="right">LIVE COURSES</Table.Th>
            <Table.Th>FIRST SEEN</Table.Th>
            <Table.Th>LAST ATTENDED</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.studentId} data-student-row>
              <Table.Td fw={600}>
                {r.name}{" "}
                {r.status === "INACTIVE" && (
                  <Badge size="xs" variant="light" color="gray">
                    Inactive
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>{dash(r.nickname)}</Table.Td>
              <Table.Td ta="right" className="tabular-nums">{dash(r.age)}</Table.Td>
              <Table.Td>{dash(r.gender)}</Table.Td>
              <Table.Td>{dash(r.parentName)}</Table.Td>
              <Table.Td className="tabular-nums">{dash(r.parentPhone)}</Table.Td>
              <Table.Td>{dash(r.province)}</Table.Td>
              <Table.Td>{r.activities.length ? r.activities.join(", ") : "—"}</Table.Td>
              <Table.Td ta="right" className="tabular-nums">{r.liveEntitlements}</Table.Td>
              <Table.Td className="tabular-nums">{ddmmyy(r.firstSeenOn) || "—"}</Table.Td>
              <Table.Td className="tabular-nums">{ddmmyy(r.lastAttendedOn) || "—"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** Downloads the VISIBLE rows (what the filters show now), UTF-8 with BOM. */
function download(rows: StudentRow[]) {
  const blob = new Blob([studentsCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "students.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function Counts({ data }: { data: StudentsResult }) {
  return (
    <Text size="sm" c="dimmed" data-student-counts>
      Active {data.counts.active} · Inactive {data.counts.inactive} · Showing {data.rows.length}
    </Text>
  );
}

/** STUDENT — search (name / nickname / parent phone) + status (Active by default) + an activity filter, the counts and the CSV export (SPEC-103 §3). */
export default function StudentTab() {
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StudentStatusFilter>("ACTIVE");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const query = useStudents({ q: q || undefined, status, subjectId: subjectId ?? undefined });
  // 🟡 Q (Sector): SPEC-103 has no "list activities" read and a StudentRow carries activity NAMES, not ids. [team-proposed] the filter's options are the activities
  // that had a course or voucher row in the last 366 days (one `getCourses` call, ids from there). If Sector wants another source, only this line moves.
  const today = todayBangkok();
  const options = useCourses({ from: dayjs(today).subtract(365, "day").format("YYYY-MM-DD"), to: today });
  const activityOptions = [...new Map((options.data?.rows ?? []).flatMap((r) => (r.subjectId === null ? [] : [[r.subjectId, r.subjectName] as const]))).entries()].map(([value, label]) => ({ value, label }));

  return (
    <div className="space-y-4">
      <Card padding="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQ(draft.trim());
          }}
        >
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput label="Search" placeholder="Name, nickname or parent phone" value={draft} onChange={(e) => setDraft(e.currentTarget.value)} w={260} />
            <Select label="Status" data={STATUS_OPTIONS} value={status} onChange={(v) => setStatus((v ?? "ACTIVE") as StudentStatusFilter)} allowDeselect={false} w={140} />
            <Select
              label="Activity"
              data={activityOptions}
              value={subjectId}
              onChange={setSubjectId}
              placeholder="All"
              clearable
              w={180}
            />
            <Button type="submit">Search</Button>
            <Button variant="default" leftSection={<Download size={16} />} disabled={!query.data || query.data.rows.length === 0} onClick={() => query.data && download(query.data.rows)}>
              Export CSV
            </Button>
          </Group>
        </form>
        {query.data && <Counts data={query.data} />}
      </Card>
      <Card padding={0}>{query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !query.data ? <LoadingState /> : <StudentTable rows={query.data.rows} />}</Card>
    </div>
  );
}
