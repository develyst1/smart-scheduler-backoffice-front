"use client";

import { Badge, Button, Card, Group, Table, Text, Title } from "@mantine/core";
import { Bell, Check } from "lucide-react";
import { useMarkAllRead, useMarkRead, useNotifications } from "./NotificationData";
import { TONE, unreadCount } from "./notification-logic";
import { useRole } from "@/context/RoleContext";
import { fmtDate } from "@/components/partials/Salary/money";
import { ErrorState, LoadingState } from "@/components/partials/Salary/parts";
import { PageTitle } from "@/components/partials/Salary/PeopleParts";
import type { NotificationItem } from "@/types/app/notification";

/**
 * TASK-914 — NOTIFICATION › Notification Alert (the web feed): what this person received — type · text · date (dd/mm/yy, no time) · read / unread — with «Mark as read» and «Mark all as read».
 * In the web, not LINE. Marking read is the fixture's (local) for now. No generation here: the events that create these items are a backend follow-on. An Admin's items carry no money (R0).
 */
export function NotificationFeedBody({ items, onRead, onReadAll }: { items: NotificationItem[]; onRead: (id: string) => void; onReadAll: () => void }) {
  const unread = unreadCount(items);
  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle
        title="Notification Alert"
        actions={
          <Button variant="default" leftSection={<Check size={16} />} onClick={onReadAll} disabled={unread === 0} data-read-all>
            Mark all as read
          </Button>
        }
      />
      <Card padding="md">
        <Group gap="xs" mb="xs">
          <Bell size={18} />
          <Title order={4} fz={16} fw={600} data-unread-count>
            {unread} new
          </Title>
        </Group>
        <Table.ScrollContainer minWidth={560}>
          <Table verticalSpacing="sm">
            <Table.Tbody>
              {items.map((n) => (
                <Table.Tr key={n.id} opacity={n.read ? 0.55 : 1} data-notification={n.id} data-read={n.read ? "true" : "false"}>
                  <Table.Td w={1}>
                    <Badge variant="light" color={TONE[n.type]} tt="none">
                      {n.type}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={n.read ? 400 : 500}>
                      {n.text}
                    </Text>
                  </Table.Td>
                  <Table.Td c="dimmed" className="tabular-nums" style={{ whiteSpace: "nowrap" }}>
                    {fmtDate(n.date)}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Button size="compact-sm" variant="subtle" disabled={n.read} onClick={() => onRead(n.id)}>
                      Mark as read
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
              {items.length === 0 && (
                <Table.Tr>
                  <Table.Td>
                    <Text c="dimmed" size="sm" ta="center">
                      {/* PENDING (Porter): not in the final UI */}
                      No notifications
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </div>
  );
}

export default function NotificationFeed() {
  const role = useRole();
  const feed = useNotifications(role);
  const read = useMarkRead(role);
  const readAll = useMarkAllRead(role);
  if (feed.isError) return <ErrorState error={feed.error} onRetry={() => feed.refetch()} />;
  if (!role || !feed.data) return <LoadingState />;
  return <NotificationFeedBody items={feed.data} onRead={(id) => read.mutate(id)} onReadAll={() => readAll.mutate()} />;
}
