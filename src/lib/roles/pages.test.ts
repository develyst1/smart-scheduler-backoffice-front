// The SALARY menu: order matches the final UI (Employee · Payment Setting · Monthly Payment · … · Daily), and each role sees only its own rows.
// Run: `bun test src/lib/roles`.
import { describe, expect, test } from "bun:test";
import { canOpen, menuFor, ruleFor } from "./pages";

const salary = (role: "ceo" | "admin" | "coach") => (menuFor(role).find((g) => g.group === "SALARY")?.items ?? []).map((i) => i.href);

describe("SALARY menu", () => {
  test("CEO: Employee, Payment Setting, Pay run, Daily, Salary Report — the final UI's order, Pay run listed once", () => {
    // 🔻 TASK-923: Salary Report (/salary/reports) added after Daily.
    expect(salary("ceo")).toEqual(["/salary/people", "/salary/settings", "/salary/payrun", "/salary/daily", "/salary/reports"]);
  });
  test("Admin: Employee and Other Income only (no pay run); Coach: Payment Detail only", () => {
    expect(salary("admin")).toEqual(["/salary/people", "/salary/entries"]);
    expect(salary("coach")).toEqual(["/salary/my-slip"]);
  });
  test("the pay run is CEO-gated, and the slip page under /salary still resolves to a CEO-only rule", () => {
    expect(canOpen("ceo", "/salary/payrun")).toBe(true);
    for (const r of ["admin", "coach"] as const) {
      expect(canOpen(r, "/salary/payrun")).toBe(false);
      expect(canOpen(r, "/salary/slip/abc")).toBe(false);
    }
    expect(canOpen("ceo", "/salary/slip/abc")).toBe(true);
    expect(ruleFor("/salary/payrun")?.href).toBe("/salary/payrun");
  });
});
