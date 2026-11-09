import { Suspense } from "react";
import Person from "@/components/partials/Salary/Person";
import { LoadingState } from "@/components/partials/Salary/parts";

// `useSearchParams` (the `?name=`) needs a Suspense boundary for the build.
export default function SalaryPersonPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Person />
    </Suspense>
  );
}
