// TASK-923 — the Salary Report page (REQ-120 R1.8): CEO only, two tabs (Teaching · Pay), Excel per tab, on the REAL API since TASK-922 (BB) was accepted.
// No network: axios gets a recording adapter that answers with the typed fixtures (the shapes of TASK-922's report). Each test names the code whose removal makes it fail.
// Run: `bun test src/components/partials/Salary/salary-923`.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import type { InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import { canOpen, menuFor } from "@/lib/roles/pages";
import {
  REPORTS_SOURCE,
  exportReportExcel,
  getPayReport,
  getTeachingReport,
  listCoachNames,
  listReportPeriods,
  reportExcelName,
  reportExcelParams,
  reportExcelPath,
} from "@/services/salary-reports.service";
import { PAY_FIXTURE, REPORT_NAMES_FIXTURE, TEACHING_FIXTURE } from "@/services/__fixtures__/salary-reports";
import { PayTable, TeachingTable } from "./ReportsTables";
import { hoursText, joinNames, shownPay, shownTeaching, sumPay, sumTeaching } from "./reports-logic";
import { PAY_KINDS } from "@/types/app/salary-reports";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);

const realAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = realAdapter;
});

const PERIOD = { id: "per-2026-10", year: 2026, month: 10, periodStart: "2026-09-30", periodEnd: "2026-10-30", status: "open", label: "October 2026" };
const PEOPLE_WIRE = [
  ...Object.entries(REPORT_NAMES_FIXTURE).map(([teacherId, name]) => ({ teacherId, name })),
  { teacherId: "sys-none", name: "No Teacher", isSystem: true },
];

/** Answers the report routes with the fixtures, wrapped as the real API wraps them (a `period` block; pay rows also carry `otherIncomeSatang`). */
function stub() {
  const seen: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    seen.push(config);
    const url = config.url ?? "";
    let data: unknown = {};
    if (url.endsWith("/reports/teaching")) data = { period: PERIOD, ...structuredClone(TEACHING_FIXTURE) };
    else if (url.endsWith("/reports/pay")) data = { period: PERIOD, ...structuredClone(PAY_FIXTURE) };
    else if (url.endsWith("/entries/people")) data = PEOPLE_WIRE;
    return { status: 200, data, statusText: "", headers: {}, config };
  };
  return seen;
}
const calls = (seen: InternalAxiosRequestConfig[]) => seen.map((c) => `${(c.method ?? "get").toUpperCase()} ${c.url}${c.params ? " " + JSON.stringify(c.params) : ""}`);

describe("who may open it (PAGE_RULES, tagged TASK-923)", () => {
  const labels = (role: "ceo" | "admin" | "coach") => menuFor(role).flatMap((g) => g.items.map((i) => i.label));
  test("Salary Report is the CEO's: in her menu, not an Admin's or a Coach's, and the route is guarded", () => {
    expect(labels("ceo")).toContain("Salary Report");
    expect(labels("admin")).not.toContain("Salary Report");
    expect(labels("coach")).not.toContain("Salary Report");
    expect(canOpen("ceo", "/salary/reports")).toBe(true);
    expect(canOpen("admin", "/salary/reports")).toBe(false);
    expect(canOpen("coach", "/salary/reports")).toBe(false);
  });
  test("the service gives an Admin / a Coach nothing AND makes no call at all (hidden, never masked)", async () => {
    const seen = stub();
    for (const role of ["admin", "coach"] as const) {
      expect((await getTeachingReport(role, "per-2026-10")).rows).toEqual([]);
      expect((await getPayReport(role, "per-2026-10")).rows).toEqual([]);
      expect(await listCoachNames(role)).toEqual({});
      expect(await listReportPeriods(role)).toEqual([]);
    }
    expect(seen).toEqual([]);
  });
});

describe("the real routes (TASK-922)", () => {
  test("Teaching and Pay are read from /v1/salary/reports/{teaching,pay} with ?periodId=", async () => {
    const seen = stub();
    const t = await getTeachingReport("ceo", "per-2026-10");
    const p = await getPayReport("ceo", "per-2026-10");
    expect(calls(seen)).toEqual([
      'GET /v1/salary/reports/teaching {"periodId":"per-2026-10"}',
      'GET /v1/salary/reports/pay {"periodId":"per-2026-10"}',
    ]);
    expect(t.rows).toHaveLength(TEACHING_FIXTURE.rows.length);
    expect(p.totals.totalSatang).toBe(PAY_FIXTURE.totals.totalSatang);
  });
  test("names come from /entries/people with the system row («No Teacher») dropped", async () => {
    const seen = stub();
    const names = await listCoachNames("ceo");
    expect(calls(seen)).toEqual(["GET /v1/salary/entries/people"]);
    expect(names).toEqual({ t1: "Pete", t2: "May", t3: "Ton" });
    expect(Object.values(names)).not.toContain("No Teacher");
  });
  test("the data is on the API switch", () => {
    expect(REPORTS_SOURCE).toBe("api");
  });
});

describe("Teaching tab", () => {
  test("hours are minutes / 60 with two decimals", () => {
    expect(hoursText(90)).toBe("1.50");
    expect(hoursText(0)).toBe("0.00");
    expect(hoursText(1020)).toBe("17.00");
  });
  test("the columns of R1.8 are there, with «Camp (hours)» — and NO money anywhere", async () => {
    stub();
    const html = ui(<TeachingTable report={await getTeachingReport("ceo", "p")} names={await listCoachNames("ceo")} />);
    for (const w of ["Coach", "Role", "Private", "Duo", "Group", "ECA", "Camp (hours)", "Weekday", "Weekend", "Total", "Classes"]) expect(html).toContain(w);
    expect(html).not.toMatch(/฿|baht|Baht/);
    expect(html).not.toMatch(/\d,\d{3}\.\d{2}/); // no money-shaped figure
  });
  test("the totals row is the sum of the rows shown, in every column", async () => {
    stub();
    const rep = await getTeachingReport("ceo", "p");
    const names = await listCoachNames("ceo");
    const rows = shownTeaching(rep, names);
    const t = sumTeaching(rows);
    expect(t.totalMinutes).toBe(rows.reduce((a, r) => a + r.totalMinutes, 0));
    expect(t.sessions).toBe(rows.reduce((a, r) => a + r.sessions, 0));
    expect(t.minutesByClass.camp).toBe(480);
    expect(t.weekdayMinutes + t.weekendMinutes).toBe(t.totalMinutes);
    expect(ui(<TeachingTable report={rep} names={names} />)).toContain(hoursText(t.totalMinutes));
  });
  test("a row whose teacher has no name («No Teacher», a removed person) is never shown, even if the API sent it", async () => {
    stub();
    const rep = await getTeachingReport("ceo", "p");
    const names = await listCoachNames("ceo");
    expect(rep.rows.some((r) => r.teacherId === "sys-none")).toBe(true);
    expect(ui(<TeachingTable report={rep} names={names} />)).not.toMatch(/No Teacher|sys-none/);
    expect(shownTeaching(rep, names).map((r) => r.name)).toEqual(["Pete", "May", "Ton"]);
    expect(joinNames([{ teacherId: "x" }], {})).toEqual([]);
  });
});

describe("Pay tab", () => {
  test("Coach · Status · Base, the «Other income» group with its eight heads, and Total", async () => {
    stub();
    const html = ui(<PayTable report={await getPayReport("ceo", "p")} names={await listCoachNames("ceo")} />);
    for (const w of ["Coach", "Status", "Base", "Other income", "Freelance Hour", "Extra Hour", "OT", "Merit", "Bonus", "Commission", "Transportation", "Other ±", "Total"]) expect(html).toContain(w);
    expect(PAY_KINDS).toHaveLength(8);
    expect(html).not.toMatch(/No Teacher|sys-none/);
  });
  test("each shown row's total is the API's own total (the screen adds nothing up per row), and the totals row is Σ rows", async () => {
    stub();
    const rep = await getPayReport("ceo", "p");
    const rows = shownPay(rep, await listCoachNames("ceo"));
    for (const r of rows) expect(r.totalSatang).toBe(rep.rows.find((x) => x.teacherId === r.teacherId)!.totalSatang);
    const t = sumPay(rows);
    expect(t.totalSatang).toBe(rows.reduce((a, r) => a + r.totalSatang, 0));
    expect(t.totalSatang).toBe(rep.totals.totalSatang);
    expect(t.byKind.other).toBe(-15000);
    for (const r of rows) expect(r.baseSatang + PAY_KINDS.reduce((a, k) => a + r.byKind[k], 0)).toBe(r.totalSatang);
  });
  test("money goes through money.ts: integer satang → 2-decimal baht; an Other ± deduction is signed", async () => {
    stub();
    const html = ui(<PayTable report={await getPayReport("ceo", "p")} names={await listCoachNames("ceo")} />);
    expect(html).toContain("25,000.00"); // Pete's base 2,500,000 satang
    expect(html).toContain("−150.00"); // his Other ± −15,000 satang, with a real minus
    expect(html).toContain("+0.00"); // a zero Other is still signed
  });
});

describe("Export Excel", () => {
  test("the right URL for each tab, with the periodId, and a blob download", async () => {
    expect(reportExcelPath("teaching")).toBe("/v1/salary/reports/teaching.xlsx");
    expect(reportExcelPath("pay")).toBe("/v1/salary/reports/pay.xlsx");
    expect(reportExcelParams("per-2026-10")).toEqual({ periodId: "per-2026-10" });
    expect(reportExcelName("pay", 2026, 9)).toBe("salary-pay-2026-09.xlsx");
    const seen = stub();
    await exportReportExcel("pay", "per-2026-10", "x.xlsx").catch(() => {}); // the browser save (document / URL.createObjectURL) is not in bun; the request is what is pinned
    expect(calls(seen)).toEqual(['GET /v1/salary/reports/pay.xlsx {"periodId":"per-2026-10"}']);
    expect(seen[0].responseType).toBe("blob");
  });
});

describe("the seam", () => {
  test("no component imports the fixture", () => {
    const dir = "src/components/partials/Salary";
    for (const f of readdirSync(dir).filter((x) => /^(Reports|reports-logic)/.test(x) && !/\.test\./.test(x))) {
      expect(readFileSync(`${dir}/${f}`, "utf8")).not.toContain("__fixtures__");
    }
  });
  test("the service no longer carries the fixture (it is the tests' data only)", () => {
    expect(readFileSync("src/services/salary-reports.service.ts", "utf8")).not.toContain("__fixtures__");
  });
});
