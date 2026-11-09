"use client";

import { useState } from "react";
import { Alert, Button, Card, Tabs } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Download } from "lucide-react";
import MonthPicker from "./MonthPicker";
import { PageTitle } from "./PeopleParts";
import { ErrorState, LoadingState, errorMessage } from "./parts";
import { currentYearMonth } from "./money";
import { PayTable, TeachingTable } from "./ReportsTables";
import { useCoachNames, useMonthPeriod, usePayReport, useReportPeriods, useTeachingReport } from "./ReportsData";
import { exportReportExcel, reportExcelName } from "@/services/salary-reports.service";
import type { ReportKind } from "@/types/app/salary-reports";

/** Salary Report (R1.8, CEO only): a month's teaching hours and pay by coach, two tabs, each with its own Excel export. */
export default function Reports() {
  const [ym, setYm] = useState(currentYearMonth);
  const [tab, setTab] = useState<ReportKind>("teaching");
  const [busy, setBusy] = useState(false);
  const periods = useReportPeriods();
  const period = useMonthPeriod(periods.data, ym.year, ym.month);
  const names = useCoachNames();
  const teaching = useTeachingReport(period?.id ?? null);
  const pay = usePayReport(period?.id ?? null);

  const onExport = async () => {
    if (!period) return;
    setBusy(true);
    try {
      await exportReportExcel(tab, period.id, reportExcelName(tab, period.year, period.month));
    } catch (e) {
      notifications.show({ color: "red", message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const q = tab === "teaching" ? teaching : pay;
  let body: React.ReactNode = null;
  if (periods.isLoading) body = <LoadingState />;
  else if (periods.error) body = <ErrorState error={periods.error} onRetry={() => periods.refetch()} />;
  else if (!period) body = <Alert color="gray" variant="light">ยังไม่มี Pay run ของเดือนนี้</Alert>;
  else if (q.isLoading || names.isLoading) body = <LoadingState />;
  else if (q.error) body = <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  else if (tab === "teaching" && teaching.data) body = <TeachingTable report={teaching.data} names={names.data ?? {}} />;
  else if (tab === "pay" && pay.data) body = <PayTable report={pay.data} names={names.data ?? {}} />;

  return (
    <div>
      <PageTitle
        title="Salary Report"
        actions={
          <>
            <MonthPicker year={ym.year} month={ym.month} onChange={setYm} />
            <Button leftSection={<Download size={16} />} variant="default" disabled={!period || busy} loading={busy} onClick={onExport} data-export={tab}>
              Export Excel
            </Button>
          </>
        }
      />
      <Tabs value={tab} onChange={(v) => v && setTab(v as ReportKind)} mb="md">
        <Tabs.List>
          <Tabs.Tab value="teaching">Teaching</Tabs.Tab>
          <Tabs.Tab value="pay">Pay</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <Card padding="md">{body}</Card>
    </div>
  );
}
