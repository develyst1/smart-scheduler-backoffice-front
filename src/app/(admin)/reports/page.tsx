import PagePlaceholder from "@/components/common/PagePlaceholder";

export default function ReportsPage() {
  return (
    <PagePlaceholder
      title="รายงานผู้บริหาร"
      subtitle="P&L · มูลค่าสต๊อก · สรุป Wallet/Payroll · ตัวกรองช่วงวันที่"
      wave="Wave 4"
      endpoint="/reports/*"
      icon="reports"
    />
  );
}
