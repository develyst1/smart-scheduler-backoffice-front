import PagePlaceholder from "@/components/common/PagePlaceholder";

export default function WalletPage() {
  return (
    <PagePlaceholder
      title="Wallet นักเรียน"
      subtitle="ยอดชั่วโมงคงเหลือ · ledger ทุก debit/credit · คิวอนุมัติซื้อ · top-up"
      wave="Wave 2"
      endpoint="/wallets/*, /purchase-intents/*"
      icon="wallet"
    />
  );
}
