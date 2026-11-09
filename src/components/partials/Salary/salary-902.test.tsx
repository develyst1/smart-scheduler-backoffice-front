// TASK-902 — «Confirm this slip» on the coach's My slip (SPEC-102 §5-E4a). Run: `bun test src/components/partials/Salary`.
// No network: axios gets a recording adapter. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import { confirmMySlip, confirmMySlipBody } from "@/services/salary.service";
import { canOpen } from "@/lib/roles/pages";
import { canConfirmSlip, confirmedToast } from "./MySlip";
import { errorMessage } from "./parts";
import type { MySlipData } from "@/types/app/salary";

const realAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = realAdapter;
});

function stub(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  const seen: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    seen.push(config);
    const { status, data } = answer(config);
    const response = { status, data, statusText: "", headers: {}, config };
    if (status >= 400) throw new AxiosError(`HTTP ${status}`, "ERR_BAD_REQUEST", config, null, response);
    return response;
  };
  return seen;
}

const LOCK_AT = "2026-10-31T05:00:00.000Z"; // 12:00 Bangkok on the last day
const slip = (over: Partial<MySlipData> = {}): MySlipData => ({
  period: { year: 2026, month: 10, periodStart: "2026-09-30", periodEnd: "2026-10-30", lockAt: LOCK_AT, status: "open" },
  teacherId: "11111111-1111-4111-8111-111111111111",
  teacherName: "ต้น",
  baseAmount: 2_500_000,
  lines: [],
  total: 2_570_000,
  status: "draft",
  ...over,
});
const BEFORE = Date.parse("2026-10-20T03:00:00.000Z");
const AFTER = Date.parse("2026-10-31T05:00:01.000Z");

describe("when the button is offered (canConfirmSlip)", () => {
  test("a draft slip in an open month before the lock time ⇒ yes", () => {
    expect(canConfirmSlip(slip(), BEFORE)).toBe(true);
  });
  test("confirmed ⇒ no; locked ⇒ no (AUTO-LOCKED)", () => {
    expect(canConfirmSlip(slip({ status: "confirmed" }), BEFORE)).toBe(false);
    expect(canConfirmSlip(slip({ status: "locked" }), BEFORE)).toBe(false);
  });
  test("a locked period, or a draft past its lockAt ⇒ no", () => {
    expect(canConfirmSlip(slip({ period: { ...slip().period, status: "locked" } }), BEFORE)).toBe(false);
    expect(canConfirmSlip(slip(), AFTER)).toBe(false);
  });
  test("no slip this month ({ slip: null }) and not-loaded ⇒ no", () => {
    expect(canConfirmSlip({ slip: null }, BEFORE)).toBe(false);
    expect(canConfirmSlip(undefined, BEFORE)).toBe(false);
  });
});

describe("the request (confirmMySlip)", () => {
  test("POST /v1/salary/my-slip/confirm with the body EXACTLY { year, month } — no teacher id — and the 200 DTO comes back", async () => {
    const seen = stub(() => ({ status: 200, data: slip({ status: "confirmed" }) }));
    const res = await confirmMySlip(2026, 10);
    expect(seen.length).toBe(1);
    expect(`${seen[0].method?.toUpperCase()} ${seen[0].url}`).toBe("POST /v1/salary/my-slip/confirm");
    expect(JSON.parse(String(seen[0].data))).toEqual({ year: 2026, month: 10 });
    expect(Object.keys(JSON.parse(String(seen[0].data))).sort()).toEqual(["month", "year"]);
    expect(res.status).toBe("confirmed");
    expect(confirmMySlipBody(2026, 10)).toEqual({ year: 2026, month: 10 });
  });
  test("a re-confirm is a 200 like any other (idempotent on the server)", async () => {
    stub(() => ({ status: 200, data: slip({ status: "confirmed" }) }));
    expect((await confirmMySlip(2026, 10)).status).toBe("confirmed");
  });
});

describe("the toast and the refusals", () => {
  test("the final UI's sentence with the total from the 200 body", () => {
    expect(confirmedToast(2_570_000)).toBe("ยืนยันสลิปรอบนี้แล้ว: 25,700.00 ฿ — หลังจากนี้แก้ไม่ได้");
  });
  const REFUSALS: [number, string, string][] = [
    [409, "LOCKED", "งวดนี้ล็อกแล้ว ยืนยันไม่ได้"],
    [404, "NO_SLIP", "ไม่พบสลิปในงวดนี้"],
    [403, "NO_TEACHER", "บัญชีนี้ไม่ได้ผูกกับครู"],
  ];
  for (const [status, code, message] of REFUSALS) {
    test(`${status} ${code} shows the SERVER's sentence unchanged`, async () => {
      stub(() => ({ status, data: { error: { code, message } } }));
      const err = await confirmMySlip(2026, 10).then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).not.toBeNull();
      expect(errorMessage(err)).toBe(message);
    });
  }
});

describe("where the button lives, and who reaches the page", () => {
  test("the page offers it only through canConfirmSlip, presses the mutation once, and re-reads on success OR failure (a 409 shows AUTO-LOCKED)", () => {
    const src = readFileSync("src/components/partials/Salary/MySlip.tsx", "utf8");
    expect(src).toContain("{canConfirmSlip(q.data) && (");
    expect(src).toContain("Confirm this slip");
    expect(src).toContain('onSettled: () => qc.invalidateQueries({ queryKey: ["salary", "my-slip"] })');
    expect(src).not.toContain("Tell an admin"); // no route (TASK-882 Q4 ruling stands)
  });
  test("My slip is the coach's page: a CEO or an Admin never reaches it (unchanged guard)", () => {
    expect(canOpen("coach", "/salary/my-slip")).toBe(true);
    expect(canOpen("ceo", "/salary/my-slip")).toBe(false);
    expect(canOpen("admin", "/salary/my-slip")).toBe(false);
  });
});
