// TASK-925 / SPEC-103 §3 — the student register as CSV: the visible rows and columns, UTF-8 with a BOM (Excel opens Thai), and a formula-injection guard.
// Pure on purpose: the Blob / download lives in the component.
import type { StudentRow } from "@/types/app/reports";

export const CSV_BOM = "﻿";

/** A cell that starts with `= + - @` (or a tab / CR, which spreadsheets also treat as formula starts) gets a leading `'` so it is read as text. */
export function guardCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** RFC 4180 quoting; the guard runs first so the quote sits outside it. */
export function csvCell(v: string | number | null | undefined): string {
  const s = guardCell(v === null || v === undefined ? "" : String(v));
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const STUDENT_CSV_COLUMNS: { header: string; value: (r: StudentRow) => string | number | null }[] = [
  { header: "Name", value: (r) => r.name },
  { header: "Nickname", value: (r) => r.nickname },
  { header: "Age", value: (r) => r.age },
  { header: "Gender", value: (r) => r.gender },
  { header: "Parent", value: (r) => r.parentName },
  { header: "Phone", value: (r) => r.parentPhone },
  { header: "Province", value: (r) => r.province },
  { header: "Activities", value: (r) => r.activities.join("; ") },
  { header: "Live courses", value: (r) => r.liveEntitlements },
  { header: "First seen", value: (r) => ddmmyy(r.firstSeenOn) },
  { header: "Last attended", value: (r) => ddmmyy(r.lastAttendedOn) },
];

/** `dd/mm/yy`, or empty. */
export function ddmmyy(iso: string | null | undefined): string {
  return iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "";
}

export function studentsCsv(rows: StudentRow[]): string {
  const lines = [STUDENT_CSV_COLUMNS.map((c) => csvCell(c.header)).join(","), ...rows.map((r) => STUDENT_CSV_COLUMNS.map((c) => csvCell(c.value(r))).join(","))];
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}
