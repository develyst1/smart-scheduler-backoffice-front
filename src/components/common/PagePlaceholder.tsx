"use client";

import { Badge, Card, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { Banknote, BarChart3, Boxes, Construction, Wallet, type LucideIcon } from "lucide-react";

// Icons are resolved by key inside this client component — a server page cannot
// pass a component (function) across the RSC boundary.
const ICONS = { inventory: Boxes, wallet: Wallet, payroll: Banknote, reports: BarChart3 } as const;

export type PlaceholderIcon = keyof typeof ICONS;

interface Props {
  title: string;
  subtitle: string;
  /** which build wave delivers this screen (todo.md) */
  wave: string;
  /** Finance API dependency this screen will consume */
  endpoint: string;
  icon: PlaceholderIcon;
}

// Wave 0 stand-in: every nav route renders one of these so the shell is fully
// navigable while real feature UI is built wave by wave.
export default function PagePlaceholder({ title, subtitle, wave, endpoint, icon }: Props) {
  const Icon: LucideIcon = ICONS[icon];
  return (
    <Card maw={640} mx="auto" mt="xl" padding="xl">
      <Stack gap="md" align="center" ta="center">
        <ThemeIcon size={56} radius="xl" variant="light" color="green">
          <Icon size={28} />
        </ThemeIcon>
        <div>
          <Text fw={600} fz="lg">
            {title}
          </Text>
          <Text c="dimmed" fz="sm" mt={4}>
            {subtitle}
          </Text>
        </div>
        <Group gap="xs">
          <Badge variant="light" color="green" leftSection={<Construction size={12} />}>
            {wave}
          </Badge>
          <Badge variant="default">API: {endpoint}</Badge>
        </Group>
      </Stack>
    </Card>
  );
}
