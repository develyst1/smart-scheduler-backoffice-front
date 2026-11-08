import { Suspense } from "react";
import Slip from "@/components/partials/Salary/Slip";

export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <Slip slipId={id} />
    </Suspense>
  );
}
