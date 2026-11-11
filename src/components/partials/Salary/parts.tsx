"use client";

import { Alert, Badge, Button, Center, Loader } from "@mantine/core";
import { ApiClientError } from "@/lib/api/client";
import type { PeriodStatus, SlipStatus } from "@/types/app/salary";

/** The API's own message when there is one (e.g. 409 LOCKED); otherwise a plain fallback. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export function isLocked(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 409 && error.code === "LOCKED";
}

export function isPeriodExists(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 409 && error.code === "PERIOD_EXISTS";
}

export function LoadingState() {
  return (
    <Center h={200} role="status" aria-label="Loading">
      <Loader color="orange" />
    </Center>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Alert color="red" variant="light" title="Could not load" role="alert">
      <div className="flex flex-wrap items-center gap-3">
        <span>{errorMessage(error)}</span>
        <Button size="xs" variant="default" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Alert>
  );
}

const SLIP_COLOR: Record<SlipStatus, string> = { draft: "gray", confirmed: "blue", locked: "green" };
const SLIP_LABEL: Record<SlipStatus, string> = { draft: "Draft", confirmed: "Confirmed", locked: "Locked" };

export function SlipStatusBadge({ status }: { status: SlipStatus }) {
  return (
    <Badge variant="light" color={SLIP_COLOR[status]} tt="none" data-slip-status={status}>
      {SLIP_LABEL[status]}
    </Badge>
  );
}

export function PeriodStatusBadge({ status }: { status: PeriodStatus }) {
  return (
    <Badge variant="light" color={status === "locked" ? "green" : "yellow"} tt="none" data-period-status={status}>
      {status === "locked" ? "Locked" : "Open"}
    </Badge>
  );
}
