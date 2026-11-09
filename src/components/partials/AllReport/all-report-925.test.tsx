// TASK-925 — All Report (REPORT · COURSE · STUDENT) against the typed fake. Run: `bun test src/components/partials/AllReport`.
// Each test names the code whose removal makes it fail. The fake is imported directly; the service constant stays false (pinned).
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { PAGE_RULES, canOpen } from "@/lib/roles/pages";
import { USE_FAKE_REPORTS } from "./config";
import { fakeAs, fakeCourses, fakeOverview, fakeStudents } from "./fake";
import { CSV_BOM, csvCell, guardCell, studentsCsv } from "./csv";
import { OverviewCards, overviewCards } from "./ReportTab";
import { CourseTable } from "./CourseTab";
import { Counts, StudentTable } from "./StudentTab";
import { ALL_REPORT_TABS, LINKED } from "./AllReport";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
afterEach(() => {
  fakeAs.role = "ceo";
  fakeAs.mode = "ok";
});
const keys = (o: object) => Object.keys(o);

describe("the ship switch", () => {
  test("the fake is OFF in delivered code, and is never an env key", () => {
    expect(USE_FAKE_REPORTS).toBe(false);
    expect(readFileSync("src/components/partials/AllReport/config.ts", "utf8")).not.toContain("process.env");
  });
});

describe("the six headings (SPEC-103 §1)", () => {
  test("they come in her order; STOCK links to /stock/reports; CHECK IN and SALARY say 'Coming with Salary' until Sector names a page", () => {
    expect(ALL_REPORT_TABS.map((t) => t.label)).toEqual(["REPORT", "STOCK", "CHECK IN", "COURSE", "SALARY", "STUDENT"]);
    expect(LINKED.stock).toBe("/stock/reports");
    expect(LINKED.checkin).toBeNull();
    expect(LINKED.salary).toBeNull();
  });
});

describe("REPORT: money by ABSENCE", () => {
  test("a CEO's answer shows revenue and refunds; an admin's answer has the keys absent, and no card at all (not 0, not hidden)", async () => {
    const ceo = await fakeOverview({ month: "2026-11" });
    expect(keys(ceo)).toContain("revenueMinor");
    expect(overviewCards(ceo).map((c) => c.key)).toContain("refundsMinor");
    fakeAs.role = "admin";
    const admin = await fakeOverview({ month: "2026-11" });
    expect(keys(admin)).not.toContain("revenueMinor");
    expect(keys(admin)).not.toContain("refundsMinor");
    const html = ui(<OverviewCards current={admin} previous={await fakeOverview({ month: "2026-10" })} />);
    expect(html).not.toMatch(/Revenue|Refunds|฿/);
    expect(html).toContain("New students");
  });
  test("each card shows this month and the previous month side by side; refunds print with a real minus", async () => {
    const html = ui(<OverviewCards current={await fakeOverview({ month: "2026-11" })} previous={await fakeOverview({ month: "2026-10" })} />);
    expect(html).toContain("Previous month: 19"); // new students, October
    expect(html).toContain("−3,500 ฿");
    expect(html).toContain("148,200 ฿");
  });
  test("the cards follow §4's order", async () => {
    expect(overviewCards(await fakeOverview({ month: "2026-11" })).map((c) => c.key)).toEqual([
      "newStudents", "activeStudents", "trialsBooked", "trials", "trialsConverted", "coursesSold", "vouchersSold", "sessionsTaught", "revenueMinor", "refundsMinor",
    ]);
  });
});

describe("COURSE", () => {
  test("the CEO's table has the Revenue column, a totals row that is the column sums, and the unmatched note", async () => {
    const data = await fakeCourses({ from: "2026-11-01", to: "2026-11-09" });
    const html = ui(<CourseTable data={data} />);
    for (const h of ["ACTIVITY", "KIND", "SIZE", "SOLD", "ACTIVE", "PAUSED", "ENDED", "SESSIONS TAUGHT", "REVENUE"]) expect(html).toContain(h);
    expect(html).toContain("data-course-totals");
    expect(data.totals.sold).toBe(data.rows.reduce((s, r) => s + r.sold, 0));
    expect(html).toContain("Private");
    expect(html).toContain("Voucher");
    expect(html).toContain("data-unmatched-note");
  });
  test("an admin's table has no Revenue column and no unmatched note (the keys are absent)", async () => {
    fakeAs.role = "admin";
    const data = await fakeCourses({ from: "2026-11-01", to: "2026-11-09" });
    expect(data.rows.every((r) => !("revenueMinor" in r))).toBe(true);
    expect(keys(data.totals)).not.toContain("revenueMinor");
    const html = ui(<CourseTable data={data} />);
    expect(html).not.toMatch(/REVENUE|฿|data-unmatched-note/);
    expect(html).toContain("SESSIONS TAUGHT");
  });
  test("the unmatched note is not drawn when it is 0 or absent", async () => {
    const data = await fakeCourses({ from: "2026-11-01", to: "2026-11-09" });
    expect(ui(<CourseTable data={{ ...data, totals: { ...data.totals, unmatchedRevenueMinor: 0 } }} />)).not.toContain("data-unmatched-note");
  });
  test("SPEC-103 §7: a VOUCHER row reads 'Voucher' (no activity, never paused); the REPORT cards say Trials booked / Trials attended / Converted", async () => {
    const data = await fakeCourses({ from: "2026-11-01", to: "2026-11-09" });
    const v = data.rows.filter((r) => r.kind === "VOUCHER");
    expect(v.length).toBe(2);
    expect(v.every((r) => r.subjectId === null && r.paused === 0)).toBe(true);
    expect(ui(<CourseTable data={data} />)).toContain("Voucher");
    const html = ui(<OverviewCards current={await fakeOverview({ month: "2026-11" })} previous={undefined} />);
    for (const w of ["Trials booked", "Trials attended", "Converted"]) expect(html).toContain(w);
    expect(html).not.toContain("Trials converted");
  });
  test("the 'Active uses today's sessions left' note shows only when activeIsApprox is true", async () => {
    const past = await fakeCourses({ from: "2026-11-01", to: "2026-11-02" });
    expect(past.activeIsApprox).toBe(true);
    expect(ui(<CourseTable data={past} />)).toContain("data-active-approx");
    const now = { ...past, activeIsApprox: false };
    expect(ui(<CourseTable data={now} />)).not.toContain("data-active-approx");
  });
  test("an empty period says 'No data for this period'", async () => {
    fakeAs.mode = "empty";
    expect(ui(<CourseTable data={await fakeCourses({ from: "2026-11-01", to: "2026-11-09" })} />)).toContain("No data for this period");
  });
  test("the fake's rows are in the SPEC order: activity, then kind (PRIVATE, DUO, VOUCHER), then size", async () => {
    const { rows } = await fakeCourses({ from: "2026-11-01", to: "2026-11-09" });
    const rank = { PRIVATE: 0, DUO: 1, VOUCHER: 2 } as const;
    const sorted = [...rows].sort((a, b) => a.subjectName.localeCompare(b.subjectName) || rank[a.kind] - rank[b.kind] || a.size - b.size);
    expect(rows.map((r) => `${r.subjectName}/${r.kind}/${r.size}`)).toEqual(sorted.map((r) => `${r.subjectName}/${r.kind}/${r.size}`));
  });
});

describe("STUDENT", () => {
  test("status defaults to ACTIVE; Inactive and All widen it; the counts cover both", async () => {
    const active = await fakeStudents({});
    expect(active.rows.every((r) => r.status === "ACTIVE")).toBe(true);
    expect((await fakeStudents({ status: "INACTIVE" })).rows.every((r) => r.status === "INACTIVE")).toBe(true);
    const all = await fakeStudents({ status: "ALL" });
    expect(all.rows.length).toBe(active.counts.active + active.counts.inactive);
    expect(ui(<Counts data={active} />)).toContain("Active 2 · Inactive 2 · Showing 2");
  });
  test("search matches name, nickname or parent phone", async () => {
    expect((await fakeStudents({ q: "alpha", status: "ALL" })).rows.length).toBe(1);
    expect((await fakeStudents({ q: "chip", status: "ALL" })).rows[0].name).toBe("Charlie Test");
    expect((await fakeStudents({ q: "0810000002", status: "ALL" })).rows[0].name).toBe("Bravo Test");
  });
  test("the table shows the eleven columns and no money", async () => {
    const html = ui(<StudentTable rows={(await fakeStudents({ status: "ALL" })).rows} />);
    for (const h of ["NAME", "NICKNAME", "AGE", "GENDER", "PARENT", "PHONE", "PROVINCE", "ACTIVITIES", "LIVE COURSES", "FIRST SEEN", "LAST ATTENDED"]) expect(html).toContain(h);
    expect(html).not.toMatch(/฿|REVENUE/);
    expect(html).toContain("04/03/26"); // dd/mm/yy
  });
  test("an empty register says 'No data for this period'", () => {
    expect(ui(<StudentTable rows={[]} />)).toContain("No data for this period");
  });
});

describe("the CSV export (formula-injection guard, BOM)", () => {
  test("a cell starting with = + - @ gets a leading apostrophe; an ordinary cell does not", () => {
    for (const c of ["=SUM(A1)", "+1", "-2", "@x"]) expect(guardCell(c)).toBe(`'${c}`);
    expect(guardCell("Alpha")).toBe("Alpha");
    expect(guardCell("a=b")).toBe("a=b");
  });
  test("commas, quotes and line breaks are quoted; null is empty", () => {
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvCell(null)).toBe("");
    expect(csvCell("=A,B")).toBe(`"'=A,B"`);
  });
  test("the file starts with the UTF-8 BOM, has the header and one line per VISIBLE row, and guards the injected name", async () => {
    const rows = (await fakeStudents({ status: "ALL" })).rows;
    const csv = studentsCsv(rows);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(`${CSV_BOM}Name,Nickname,Age,Gender,Parent,Phone,Province,Activities,Live courses,First seen,Last attended`);
    expect(lines.length).toBe(rows.length + 1);
    expect(csv).toContain("'=Delta Test");
    expect(csv).not.toContain(",=Delta");
  });
  test("the export covers only what is shown: an Active-only list exports only active students", async () => {
    const csv = studentsCsv((await fakeStudents({})).rows);
    expect(csv).not.toContain("Charlie Test");
  });
});

describe("REPORT with a branch (SPEC-103 / 926 review)", () => {
  test("choosing a branch shows 'Students: all branches' (a student has no branch); with All it is not drawn", () => {
    const src = readFileSync("src/components/partials/AllReport/ReportTab.tsx", "utf8");
    expect(src).toMatch(/b !== undefined && \(\s*<Text[^>]*data-students-all-branches/);
    expect(src).toContain("Students: all branches");
  });
});

describe("states", () => {
  test("the fake can fail, so the error state has something to show", async () => {
    fakeAs.mode = "error";
    await expect(fakeOverview({ month: "2026-11" })).rejects.toThrow();
    await expect(fakeStudents({})).rejects.toThrow();
  });
  test("/reports serves All Report; PAGE_RULES lets CEO and Admin in (menu), not a Coach, and carries no money flag (the API omits the keys)", () => {
    expect(readFileSync("src/app/(admin)/reports/page.tsx", "utf8")).toContain("<AllReport />");
    const rule = PAGE_RULES.find((p) => p.href === "/reports");
    expect(rule?.roles).toEqual(["ceo", "admin"]);
    expect(rule?.money).toBeUndefined();
    expect(rule?.menu).toBe(true);
    expect(canOpen("admin", "/reports")).toBe(true);
    expect(canOpen("coach", "/reports")).toBe(false);
  });
});
