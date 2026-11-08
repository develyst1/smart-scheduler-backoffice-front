"use client";

import Link from "next/link";
import { Button, Card, Center, Group, Loader, Text } from "@mantine/core";
import { ApiClientError } from "@/lib/api/client";

/** Page title + the action buttons the final UI shows beside it. Actions are real links. */
export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: { href: string; label: string; primary?: boolean; icon?: React.ReactNode }[];
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <Group gap="xs" wrap="wrap">
        {actions?.map((a) => (
          <Button
            key={a.href}
            component={Link}
            href={a.href}
            variant={a.primary ? "filled" : "default"}
            leftSection={a.icon}
          >
            {a.label}
          </Button>
        ))}
      </Group>
    </div>
  );
}

/** The API's own message when there is one; otherwise the transport error. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export function LoadingState() {
  return (
    <Center h={200} role="status" aria-label="Loading">
      <Loader color="orange" />
    </Center>
  );
}

/** Empty is its own state, worded and drawn nothing like loading. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Text c="dimmed" size="sm" ta="center" py="lg">
      {children}
    </Text>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Card padding="lg" role="alert">
      <Text c="red" fw={500}>
        {errorMessage(error)}
      </Text>
      <Button mt="sm" variant="default" w="max-content" onClick={onRetry}>
        Retry
      </Button>
    </Card>
  );
}
