import { Suspense } from "react";
import RevenueDetail from "@/components/partials/RevenueLedger/RevenueDetail";

// useSearchParams (the Summary's "View" link seeds the filters) needs a Suspense boundary.
export default function RevenueDetailPage() {
  return (
    <Suspense>
      <RevenueDetail />
    </Suspense>
  );
}
