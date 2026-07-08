"use client";

import { Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { Wallet, Boxes, Banknote, TrendingUp, type LucideIcon } from "lucide-react";

interface Stat {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

// Placeholder KPIs — wired to the Finance API reports endpoints in Wave 4.
const STATS: Stat[] = [
  { key: "wallet", label: "ยอด Wallet คงเหลือรวม", value: "—", hint: "รอ /reports", icon: Wallet },
  { key: "stock", label: "สินค้าใกล้หมด", value: "—", hint: "รอ /inventory", icon: Boxes },
  { key: "payroll", label: "Payroll เดือนนี้", value: "—", hint: "รอ /payroll", icon: Banknote },
  { key: "pnl", label: "กำไรสุทธิเดือนนี้", value: "—", hint: "รอ /reports", icon: TrendingUp },
];

export default function DashboardContent() {
  return (
    <Stack gap="lg">
      <div>
        <Text fw={600} fz="xl">
          ภาพรวมหลังบ้าน
        </Text>
        <Text c="dimmed" fz="sm">
          สรุป Wallet · สต๊อก · Payroll · กำไร-ขาดทุน (ตัวเลขจริงเชื่อม API ใน Wave 4)
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.key} padding="lg">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text c="dimmed" fz="xs">
                    {s.label}
                  </Text>
                  <Text fw={700} fz={28} lh={1}>
                    {s.value}
                  </Text>
                  <Text c="dimmed" fz="xs">
                    {s.hint}
                  </Text>
                </Stack>
                <ThemeIcon size={40} radius="md" variant="light" color="green">
                  <Icon size={20} />
                </ThemeIcon>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
