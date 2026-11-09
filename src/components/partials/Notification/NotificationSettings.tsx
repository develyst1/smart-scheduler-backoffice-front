"use client";

import { Badge, Card, Group, Table, Title } from "@mantine/core";
import { useNotificationCoaches, useNotificationRecipients } from "./NotificationData";
import { useRole } from "@/context/RoleContext";
import { ErrorState, LoadingState } from "@/components/partials/Salary/parts";
import { PageTitle } from "@/components/partials/Salary/PeopleParts";
import type { NotifyCoach, NotifyRecipient } from "@/types/app/notification";

/**
 * NOTIFICATION › Notification Setting (CEO): a plain, READ-ONLY recipient list — who is told about what, in the web (not LINE). Final UI `NotifySettings.tsx`.
 * Ruling C-h (REQ-122): no opt-out ticks, everyone always gets all their own — so there are no switches and nothing to save; the list reflects the role-derived rules. No pay data (R0).
 */
export function NotificationSettingsBody({ recipients, coaches }: { recipients: NotifyRecipient[]; coaches: NotifyCoach[] }) {
  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Notification Setting" />
      <Card padding="md" mb="md">
        <Group justify="space-between" mb="xs">
          <Title order={4} fz={16} fw={600}>
            CEO and Staff
          </Title>
          <Badge variant="light" tt="none">
            In the web
          </Badge>
        </Group>
        <Table.ScrollContainer minWidth={520}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Who</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Gets</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recipients.map((r) => (
                <Table.Tr key={r.who} data-recipient={r.who}>
                  <Table.Td fw={600}>{r.who}</Table.Td>
                  <Table.Td>{r.role}</Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      {r.gets.map((g) => (
                        <Badge key={g} variant="light" color="green" tt="none">
                          {g}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Card padding="md">
        <Title order={4} fz={16} fw={600} mb="xs">
          Coach (Full-time / Part-time)
        </Title>
        <Table.ScrollContainer minWidth={520}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Who</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Bonus · Commission · Transportation · OT · Other</Table.Th>
                <Table.Th>Extra Hour</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {coaches.map((c) => (
                <Table.Tr key={c.who} data-coach={c.who}>
                  <Table.Td fw={600}>{c.who}</Table.Td>
                  <Table.Td>{c.type}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="green">
                      MYSELF - ALWAYS
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="green">
                      MYSELF - ALWAYS
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </div>
  );
}

export default function NotificationSettings() {
  const role = useRole();
  const recipients = useNotificationRecipients(role);
  const coaches = useNotificationCoaches(role);
  if (recipients.isError) return <ErrorState error={recipients.error} onRetry={() => recipients.refetch()} />;
  if (coaches.isError) return <ErrorState error={coaches.error} onRetry={() => coaches.refetch()} />;
  if (!role || !recipients.data || !coaches.data) return <LoadingState />;
  return <NotificationSettingsBody recipients={recipients.data} coaches={coaches.data} />;
}
