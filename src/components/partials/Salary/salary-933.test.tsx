// TASK-933 (D-150-1, Team B half) — Team B's Salary screens are English; the CEO is never shown a form that refuses Other Income. Run: `bun test src/components/partials/Salary/salary-933`.
// Each test names the code whose removal makes it fail. «Thai» = the Thai letters (U+0E01–U+0E5B); the baht sign ฿ (U+0E3F) is a currency, not language, and is ignored.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { canOpen, menuFor, ruleFor } from "@/lib/roles/pages";
import { PAY_FIXTURE, REPORT_NAMES_FIXTURE, TEACHING_FIXTURE } from "@/services/__fixtures__/salary-reports";
import { PEOPLE_FIXTURE, PROFILES_FIXTURE, SETTINGS_FIXTURE } from "@/services/__fixtures__/salary-people";
import { PeopleBody } from "./People";
import { PersonBody } from "./Person";
import { SettingsBody } from "./Settings";
import { MySlipBody, confirmedToast } from "./MySlip";
import { EntriesCeoPointer } from "./Entries";
import { PayTable, TeachingTable } from "./ReportsTables";
import MonthPicker from "./MonthPicker";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const noop = () => {};

/**
 * The ONLY Thai kept on these screens: what the customer herself wrote in Thai for the Payment Setting page and asked to keep —
 * her v3 answers, 2026-10-23: «ซ้ายขวา 4 บรรทัดล่างของ Commission ** ใส่ภาษาไทยตามที่เขียนให้เลยค่ะ» (CUSTOMER-ANSWERS.md l.169; verbatim file `khwan-answers-v3-part1-2026-10-23-VERBATIM.md` p.3 l.72).
 * The lines are CUSTOMER-ANSWERS.md l.94–98 (the Full-time / Part-time · Freelance sentences and the three commission notes) and l.110–112 (the three Transportation notes, same page p.3 l.92/96/97 — she wrote them in Thai on that sheet;
 * whether the «ใส่ภาษาไทย» instruction also covers these three is flagged to Silver / Porter in the TASK-933 report).
 */
const KEPT_THAI = [
  "รวมค่าคอมของทั้งเดือน และหารแบ่งตามจำนวนของครูฟูลไทม์ (จ่ายสิ้นเดือน) ครูใหม่ที่เข้ามาระหว่างเดือน จะได้รับสัดส่วนเท่ากัน",
  "จ่ายแยกของใครของมัน",
  "*หากมีครูมากกว่า 1 คน ให้หารแบ่งเท่า ๆ กัน",
  "**หากมีส่วนลด ค่าคอมยังเท่าเดิม และสามารถปรับค่าคอมได้ด้วยในบางกรณี",
  "***หากจ่ายสด กรอก 0",
  "**หากค่ารถ (ต่อเที่ยว) ที่คำนวณน้อยกว่า Minimum ให้จ่ายที่ Minimum",
  "*คำนวณระยะทางโดยใช้กิโลจากมอเตอร์ไซค์",
  "**หากใช้รถยนตร์ ให้เทียบกิโลเมตรอีกครั้ง",
];
const THAI = /[ก-฾เ-๛]/g; // every Thai letter, vowel, tone mark and digit — but not U+0E3F (฿)
const thaiLeft = (text: string): string[] => {
  let t = text;
  for (const k of KEPT_THAI) t = t.split(k).join("");
  return t.match(THAI) ?? [];
};
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("no Thai left on Team B's Salary screens (except the kept-and-cited customer sentences)", () => {
  const FILES = [
    "People.tsx", "PeopleParts.tsx", "PeopleData.ts", "Person.tsx", "Settings.tsx", "Daily.tsx", "MySlip.tsx", "Entries.tsx", "entries-logic.ts",
    "Reports.tsx", "ReportsTables.tsx", "ReportsData.ts", "reports-logic.ts", "MonthPicker.tsx",
  ].map((f) => `src/components/partials/Salary/${f}`).concat(["src/services/salary-people.service.ts", "src/services/salary-reports.service.ts", "src/types/app/salary-people.ts", "src/types/app/salary-reports.ts"]);
  test("the SOURCE of every Team B salary file (comments aside): no Thai letter outside the kept list — strings, toasts, empty states, labels", () => {
    for (const f of FILES) expect([f, thaiLeft(stripComments(readFileSync(f, "utf8")))]).toEqual([f, []]);
  });
  test("the RENDERED screens: Employee · Employee Profile · Payment Setting · My slip (empty) · Salary Report (both tabs) · the month picker — nothing but the kept sentences", async () => {
    const people = ui(<PeopleBody people={PEOPLE_FIXTURE} role="ceo" onOpen={noop} />);
    const person = ui(<PersonBody profile={{ name: "Ton", ...PROFILES_FIXTURE["Ton"] }} options={[{ value: "Ton", label: "Ton" }]} onPick={noop} onBack={noop} />);
    const settings = ui(<SettingsBody settings={SETTINGS_FIXTURE} />);
    const slipEmpty = ui(<MySlipBody data={{ slip: null }} />);
    const teaching = ui(<TeachingTable report={TEACHING_FIXTURE} names={REPORT_NAMES_FIXTURE} />);
    const pay = ui(<PayTable report={PAY_FIXTURE} names={REPORT_NAMES_FIXTURE} />);
    const picker = ui(<MonthPicker year={2026} month={10} onChange={noop} />);
    for (const [name, html] of Object.entries({ people, person, settings, slipEmpty, teaching, pay, picker })) expect([name, thaiLeft(html)]).toEqual([name, []]);
    // the kept sentences ARE there (she asked for them as she wrote them)
    for (const k of KEPT_THAI.slice(0, 5)) expect(settings).toContain(k.replace(/\*/g, "")); // the notes' asterisks are drawn apart from the text
    expect(slipEmpty).toContain("No slip for this period yet");
    expect(picker).toContain("Oct 2026"); // English month, `MMM YYYY`
  });
  test("the toast of a confirmed slip is English", () => {
    expect(confirmedToast(2_570_000)).toBe("Slip confirmed: 25,700.00 ฿ — it can no longer be edited");
  });
});

describe("the CEO and Other Income (Porter 21:24: a CEO is never shown a link that refuses her)", () => {
  const salary = (role: "ceo" | "admin" | "coach") => (menuFor(role).find((g) => g.group === "SALARY")?.items ?? []).map((i) => i.label);
  test("the CEO's menu has no «Other Income»; the admin's still has it; a coach's neither", () => {
    expect(salary("ceo")).not.toContain("Other Income");
    expect(salary("admin")).toContain("Other Income");
    expect(salary("coach")).not.toContain("Other Income");
    expect(salary("admin")).toEqual(["Employee", "Other Income"]); // the admin's list is unchanged
  });
  test("the CEO may open /salary/entries (she gets the pointer there, not the shell's «no access» card); the admin too; a coach may not", () => {
    expect(canOpen("ceo", "/salary/entries")).toBe(true);
    expect(canOpen("admin", "/salary/entries")).toBe(true);
    expect(canOpen("coach", "/salary/entries")).toBe(false);
    expect(ruleFor("/salary/entries")?.menuRoles).toEqual(["admin"]);
  });
  test("the CEO's page is ONE pointer with a link to the Pay run — and no form, no money field, no Save", () => {
    const html = ui(<EntriesCeoPointer />);
    expect(html).toContain("Add income lines for a coach on the Payment Detail (slip)");
    expect(html).toContain('href="/salary/payrun"');
    expect(html).toContain("Open Pay run");
    expect(html).not.toMatch(/<form|<input|Save|Merit|Reason|Trip/i);
  });
  test("the default Entries sends the CEO to that pointer (and makes no request for her); the admin's form is the same component as before", () => {
    const src = readFileSync("src/components/partials/Salary/Entries.tsx", "utf8");
    expect(/export default function Entries\(\)\s*\{\s*const role = useRole\(\);\s*if \(role === "ceo"\) return <EntriesCeoPointer \/>;\s*return <EntriesForm \/>;/.test(src)).toBe(true);
    expect(src).toContain("function EntriesForm()");
  });
});
