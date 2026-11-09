import { Badge, Table } from "@mantine/core";
import { SlipStatusBadge } from "./parts";
import { formatBaht, formatSigned } from "./money";
import { CLASS_LABEL, PAY_KIND_LABEL, hoursText, shownPay, shownTeaching, sumPay, sumTeaching } from "./reports-logic";
import { CLASS_KEYS, PAY_KINDS, type PayKind, type PayReport, type TeachingReport } from "@/types/app/salary-reports";

const num = { style: { textAlign: "right" as const } };

/** Tab 1 — Teaching hours (no money anywhere): per coach, hours by class, weekday / weekend, total and class count. */
export function TeachingTable({ report, names }: { report: TeachingReport; names: Record<string, string> }) {
  const rows = shownTeaching(report, names);
  const tot = sumTeaching(rows);
  return (
    <Table.ScrollContainer minWidth={900}>
      <Table striped highlightOnHover data-report="teaching">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Coach</Table.Th>
            <Table.Th>Role</Table.Th>
            {CLASS_KEYS.map((c) => (
              <Table.Th key={c} {...num}>{c === "camp" ? "Camp (hours)" : CLASS_LABEL[c]}</Table.Th>
            ))}
            <Table.Th {...num}>Weekday</Table.Th>
            <Table.Th {...num}>Weekend</Table.Th>
            <Table.Th {...num}>Total</Table.Th>
            <Table.Th {...num}>Classes</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.teacherId} data-coach={r.name}>
              <Table.Td fw={600}>{r.name}</Table.Td>
              <Table.Td><Badge variant="light" tt="none">{r.role}</Badge></Table.Td>
              {CLASS_KEYS.map((c) => <Table.Td key={c} {...num}>{hoursText(r.minutesByClass[c])}</Table.Td>)}
              <Table.Td {...num}>{hoursText(r.weekdayMinutes)}</Table.Td>
              <Table.Td {...num}>{hoursText(r.weekendMinutes)}</Table.Td>
              <Table.Td {...num} fw={600}>{hoursText(r.totalMinutes)}</Table.Td>
              <Table.Td {...num}>{r.sessions}</Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr data-totals>
            <Table.Td colSpan={2} fw={700}>Total</Table.Td>
            {CLASS_KEYS.map((c) => <Table.Td key={c} {...num} fw={700}>{hoursText(tot.minutesByClass[c])}</Table.Td>)}
            <Table.Td {...num} fw={700}>{hoursText(tot.weekdayMinutes)}</Table.Td>
            <Table.Td {...num} fw={700}>{hoursText(tot.weekendMinutes)}</Table.Td>
            <Table.Td {...num} fw={700}>{hoursText(tot.totalMinutes)}</Table.Td>
            <Table.Td {...num} fw={700}>{tot.sessions}</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** Tab 2 — Pay: base + the "Other income" group per coach, with the API's own row total. */
export function PayTable({ report, names }: { report: PayReport; names: Record<string, string> }) {
  const rows = shownPay(report, names);
  const tot = sumPay(rows);
  const money = (k: PayKind, v: number) => (k === "other" ? formatSigned(v) : formatBaht(v));
  return (
    <Table.ScrollContainer minWidth={1100}>
      <Table striped highlightOnHover data-report="pay">
        <Table.Thead>
          <Table.Tr>
            <Table.Th rowSpan={2}>Coach</Table.Th>
            <Table.Th rowSpan={2}>Status</Table.Th>
            <Table.Th rowSpan={2} {...num}>Base</Table.Th>
            <Table.Th colSpan={PAY_KINDS.length} style={{ textAlign: "center" }} data-group="other-income">Other income</Table.Th>
            <Table.Th rowSpan={2} {...num}>Total</Table.Th>
          </Table.Tr>
          <Table.Tr>
            {PAY_KINDS.map((k) => <Table.Th key={k} {...num}>{PAY_KIND_LABEL[k]}</Table.Th>)}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.teacherId} data-coach={r.name}>
              <Table.Td fw={600}>{r.name}</Table.Td>
              <Table.Td><SlipStatusBadge status={r.slipStatus} /></Table.Td>
              <Table.Td {...num}>{formatBaht(r.baseSatang)}</Table.Td>
              {PAY_KINDS.map((k) => <Table.Td key={k} {...num}>{money(k, r.byKind[k])}</Table.Td>)}
              <Table.Td {...num} fw={600} data-row-total>{formatBaht(r.totalSatang)}</Table.Td>
            </Table.Tr>
          ))}
          <Table.Tr data-totals>
            <Table.Td colSpan={2} fw={700}>Total</Table.Td>
            <Table.Td {...num} fw={700}>{formatBaht(tot.baseSatang)}</Table.Td>
            {PAY_KINDS.map((k) => <Table.Td key={k} {...num} fw={700}>{money(k, tot.byKind[k])}</Table.Td>)}
            <Table.Td {...num} fw={700}>{formatBaht(tot.totalSatang)}</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
