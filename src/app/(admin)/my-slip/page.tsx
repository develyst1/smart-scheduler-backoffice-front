import PagePlaceholder from "@/components/common/PagePlaceholder";

export default function MySlipPage() {
  return (
    <PagePlaceholder
      title="สลิปของฉัน"
      subtitle="โค้ชเห็นเฉพาะสลิปของตัวเอง"
      wave="Block A · Salary"
      endpoint="/payroll/my-slip"
      icon="slip"
    />
  );
}
