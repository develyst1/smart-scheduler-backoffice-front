import PagePlaceholder from "@/components/common/PagePlaceholder";

export default function InventoryPage() {
  return (
    <PagePlaceholder
      title="สต๊อกสินค้า (Mini ERP/POS)"
      subtitle="รายการสินค้า · รับของเข้า · หน้าขายตัดสต๊อก · ประวัติ movement"
      wave="Wave 1"
      endpoint="/inventory/*"
      icon="inventory"
    />
  );
}
