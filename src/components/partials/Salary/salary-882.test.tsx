// TASK-882 — My slip (SPEC-102 §5-E1) + admin-blind Entries (§5-E2). Run: `bun test src/components/partials/Salary`.
// No network: axios gets a recording adapter. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api, ApiClientError } from "@/lib/api/client";
import { createEntry, getMySlip, listEntryPeople } from "@/services/salary.service";
import { MySlipBody } from "./MySlip";
import { EntryDetailTable } from "./Entries";
import { pickablePeople } from "./entries-logic";
import { errorMessage } from "./parts";
import type { MySlipData } from "@/types/app/salary";

const realAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = realAdapter;
});

/** Answer every request with `(config) => ({status, data})`, and record the request. 4xx/5xx reject like the real adapter would. */
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
const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);

const MINE: MySlipData = {
  period: { year: 2026, month: 10, periodStart: "2026-09-30", periodEnd: "2026-10-30", lockAt: "2026-10-31T05:00:00.000Z", status: "open" },
  teacherId: "11111111-1111-4111-8111-111111111111",
  teacherName: "ต้น",
  baseAmount: 2_500_000,
  lines: [
    { id: "l1", kind: "extra_hour", kindLabel: "Extra Hour", label: "14/10 (Wed): 6 Hr → extra 2 Hr × 350", amountSatang: 70_000 },
    { id: "l2", kind: "other", kindLabel: "Other", label: "หักมาสาย (สาย)", amountSatang: -20_050 },
  ],
  total: 2_549_950,
  status: "draft",
};

describe("My slip", () => {
  test("the request carries year + month and NO teacher id (the server takes it from the token)", async () => {
    const seen = stub(() => ({ status: 200, data: MINE }));
    await getMySlip(2026, 10);
    expect(seen).toHaveLength(1);
    expect(Object.keys(seen[0].params).sort()).toEqual(["month", "year"]);
    expect(seen[0].url).toBe("/v1/salary/my-slip");
    expect(JSON.stringify(seen[0])).not.toContain("teacherId");
  });

  test("renders the response: name, kind labels, per-date text, signed amounts, base and total in baht", () => {
    const html = ui(<MySlipBody data={MINE} />);
    expect(html).toContain("ต้น");
    expect(html).toContain("Extra Hour");
    expect(html).toContain("14/10 (Wed): 6 Hr");
    expect(html).toContain("+700.00");
    expect(html).toContain("−200.50"); // the deduction keeps its sign
    expect(html).toContain("25,000.00"); // base
    expect(html).toContain("25,499.50"); // total
    expect(html).toContain("Confirm by"); // open slip
    expect(html).not.toContain("data-slip-locked");
  });

  test("a locked slip drops the 'Confirm by' notice; the slip is never editable (no delete buttons)", () => {
    const html = ui(<MySlipBody data={{ ...MINE, status: "locked", period: { ...MINE.period, status: "locked" } }} />);
    expect(html).not.toContain("Confirm by");
    expect(html).not.toContain("ลบรายการ");
  });

  test("an empty month ({ slip: null }) shows the empty state, not a slip", () => {
    const html = ui(<MySlipBody data={{ slip: null }} />);
    expect(html).toContain("data-my-slip-empty");
    expect(html).toContain("No slip for this period yet"); // 🔻 TASK-933: English (D-150-1)
    expect(html).not.toContain("รวมสุทธิ");
  });
});

describe("Entries (admin-blind)", () => {
  const LEAKY = {
    lineId: "ln-1",
    kind: "merit",
    kindLabel: "Merit",
    label: "Merit",
    amountSatang: 100_000,
    // a misbehaving server: none of this may reach an admin's screen
    total: 9_876_543,
    baseAmount: 7_777_777,
    lines: [{ id: "x", kind: "fl_pay", label: "FL secret", amountSatang: 5_555_555 }],
    rate: 40_000,
  };

  test("only the five line keys survive the create call, even when the response carries pay fields", async () => {
    stub(() => ({ status: 201, data: LEAKY }));
    const line = await createEntry({ teacherId: "t", year: 2026, month: 10, kind: "merit", amountSatang: 100_000 });
    expect(Object.keys(line).sort()).toEqual(["amountSatang", "kind", "kindLabel", "label", "lineId"]);
  });

  test("the admin's Detail list renders no pay field, even from a leaky response", async () => {
    stub(() => ({ status: 201, data: LEAKY }));
    const line = await createEntry({ teacherId: "t", year: 2026, month: 10, kind: "merit", amountSatang: 100_000 });
    const html = ui(<EntryDetailTable rows={[{ date: "08/11/26", person: "ต้น", line }]} />);
    expect(html).toContain("+1,000.00"); // the amount SHE typed
    for (const secret of ["98,765.43", "77,777.77", "55,555.55", "FL secret", "400.00", "9876543", "7777777"]) expect(html).not.toContain(secret);
  });

  for (const [status, code, sentence] of [
    [400, "KIND_NOT_ALLOWED", "kind must be merit or other"],
    [422, "NOT_MERIT_ELIGIBLE", "this person is not merit-eligible"],
    [409, "LOCKED", "งวดนี้ถูกล็อกแล้ว"],
  ] as const) {
    test(`${status} ${code}: the server's own sentence is what the toast shows`, async () => {
      stub(() => ({ status, data: { error: { code, message: sentence } } }));
      let caught: unknown;
      try {
        await createEntry({ teacherId: "t", year: 2026, month: 10, kind: "merit", amountSatang: 1 });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ApiClientError);
      expect((caught as ApiClientError).code).toBe(code);
      expect(errorMessage(caught)).toBe(sentence);
    });
  }

  test('"No Teacher" (is_system) is absent from the picker; real people stay', async () => {
    const rows = [
      { teacherId: "a", name: "ต้น" },
      { teacherId: "sys", name: "No Teacher", isSystem: true },
      { teacherId: "c", name: "พลอย", isSystem: false },
    ];
    expect(pickablePeople(rows).map((p) => p.name)).toEqual(["ต้น", "พลอย"]);
    stub(() => ({ status: 200, data: rows }));
    expect((await listEntryPeople()).map((p) => p.name)).toEqual(["ต้น", "พลอย"]);
  });
});
