"use client";

import { useState } from "react";
import Link from "next/link";
import { Anchor, Card, Tabs, Text } from "@mantine/core";
import ReportTab from "./ReportTab";
import CourseTab from "./CourseTab";
import StudentTab from "./StudentTab";

// SPEC-103 §1: six headings in her order. This TASK builds REPORT, COURSE and STUDENT; the other three belong to other blocks.
export type AllReportTab = "report" | "stock" | "checkin" | "course" | "salary" | "student";
export const ALL_REPORT_TABS: { value: AllReportTab; label: string }[] = [
  { value: "report", label: "REPORT" },
  { value: "stock", label: "STOCK" },
  { value: "checkin", label: "CHECK IN" },
  { value: "course", label: "COURSE" },
  { value: "salary", label: "SALARY" },
  { value: "student", label: "STUDENT" },
];

/** Where the three other blocks' headings go. `null` = no page yet. SALARY / CHECK IN: the Salary report pages, once they are routed (Sector to name the hrefs). */
export const LINKED: Partial<Record<AllReportTab, string | null>> = { stock: "/stock/reports", checkin: null, salary: null };

function LinkedPanel({ tab, href }: { tab: AllReportTab; href: string | null }) {
  return (
    <Card padding="lg" data-linked={tab}>
      {href ? (
        <Anchor component={Link} href={href}>
          Open {ALL_REPORT_TABS.find((t) => t.value === tab)?.label} report
        </Anchor>
      ) : (
        <Text c="dimmed" ta="center">
          Coming with Salary.
        </Text>
      )}
    </Card>
  );
}

/**
 * TASK-925 — "All Report". Money is shown only when the API sends it (a CEO's answer); an admin's screen has no money column or card, by absence.
 * Every label is 🟡 PENDING (Khwan). Mounted on `/reports` (CEO + Admin). Until TASK-924/926 are wired the service has no real routes: it works only with the dev fake.
 */
export default function AllReport() {
  const [tab, setTab] = useState<AllReportTab>("report");
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">All Report</h1>
      <Tabs value={tab} onChange={(v) => setTab((v ?? "report") as AllReportTab)} keepMounted={false}>
        <Tabs.List style={{ flexWrap: "nowrap", overflowX: "auto" }}>
          {ALL_REPORT_TABS.map((t) => (
            <Tabs.Tab key={t.value} value={t.value}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="report" pt="md">
          <ReportTab />
        </Tabs.Panel>
        <Tabs.Panel value="course" pt="md">
          <CourseTab />
        </Tabs.Panel>
        <Tabs.Panel value="student" pt="md">
          <StudentTab />
        </Tabs.Panel>
        {(["stock", "checkin", "salary"] as const).map((t) => (
          <Tabs.Panel key={t} value={t} pt="md">
            <LinkedPanel tab={t} href={LINKED[t] ?? null} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
