import StockInReceive from "@/components/partials/Stock/StockInReceive";

// TASK-912 — STOCK IN: a manual receive (product + quantity + date; no cost, no price) on the fixture seam until the BE write deploys.
export default function StockInPage() {
  return <StockInReceive />;
}
