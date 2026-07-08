import PagePlaceholder from "@/components/common/PagePlaceholder";

export default function PayrollPage() {
  return (
    <PagePlaceholder
      title="ครู / Payroll"
      subtitle="ตั้งเรทครู · สรุปรายได้รายเดือน · Payroll run จากชั่วโมงจริง"
      wave="Wave 3"
      endpoint="/teachers/:id/rates, /payroll/runs/*"
      icon="payroll"
    />
  );
}
