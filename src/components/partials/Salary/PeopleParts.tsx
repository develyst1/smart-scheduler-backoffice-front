"use client";

import { Card, Group, Table, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Satang } from "@/types/app/salary-people";

// Shared bits of Team B's four SALARY screens (final-ui/src/pages/a/salary/parts.tsx + the shell's PageHeader / fmtBaht / notify).

/** 2080000 satang → "20,800 ฿" — the final UI's `fmtBaht`: whole baht, ฿ after. */
export const baht = (satang: Satang): string => `${Math.round(satang / 100).toLocaleString("en-US")} ฿`;

/** The final UI's `notify(msg, "ok")`. The words are the approved Thai toasts of the final UI. */
export const notifyOk = (message: string) => notifications.show({ color: "green", message });

/** Page title + the action buttons beside it (the final UI's `PageHeader`). */
export function PageTitle({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {actions ? <Group gap="xs" wrap="wrap">{actions}</Group> : null}
    </div>
  );
}

/** A titled card holding a label / value table (the settings and profile screens). */
export function KvCard({
  title,
  aside,
  rows,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  rows?: [React.ReactNode, React.ReactNode][];
  children?: React.ReactNode;
}) {
  return (
    <Card padding="md">
      <Group justify="space-between" mb="xs" wrap="wrap" gap="xs">
        <Title order={4} fz={16} fw={600}>
          {title}
        </Title>
        {aside}
      </Group>
      {rows && (
        <Table.ScrollContainer minWidth={280}>
          <Table verticalSpacing="xs">
            <Table.Tbody>
              {rows.map(([k, v], i) => (
                <Table.Tr key={i}>
                  <Table.Th w="38%" fw={500} c="dimmed">
                    {k}
                  </Table.Th>
                  <Table.Td>{v}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {children}
    </Card>
  );
}

/** A small explanatory line under a card ("* …"). */
export function Foot({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" c="dimmed" mt={4}>
      {children}
    </Text>
  );
}
