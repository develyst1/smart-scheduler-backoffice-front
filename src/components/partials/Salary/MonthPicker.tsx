"use client";

import { ActionIcon, Group, Text } from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthYearLabel } from "./money";

/** The ‹ month year › picker of the final UI (`MonthPicker`): previous / next month, wrapping the year. */
export default function MonthPicker({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (v: { year: number; month: number }) => void;
}) {
  const move = (n: number) => {
    const idx = year * 12 + (month - 1) + n;
    onChange({ year: Math.floor(idx / 12), month: (idx % 12) + 1 });
  };
  return (
    <Group gap={4} wrap="nowrap" data-month-picker>
      <ActionIcon variant="default" aria-label="Previous month" onClick={() => move(-1)}>
        <ChevronLeft size={16} />
      </ActionIcon>
      <Text fw={600} fz="sm" miw={86} ta="center" data-month-label>
        {monthYearLabel(year, month)}
      </Text>
      <ActionIcon variant="default" aria-label="Next month" onClick={() => move(1)}>
        <ChevronRight size={16} />
      </ActionIcon>
    </Group>
  );
}
