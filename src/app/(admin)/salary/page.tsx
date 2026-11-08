import { redirect } from "next/navigation";

// /salary is the Salary home: the pay run.
export default function SalaryHomePage() {
  redirect("/salary/payrun");
}
