// TASK-862 — Team B's four SALARY screens (Employee · Employee Profile · Payment Setting · Daily Training Report). Run: `bun test src/components/partials/Salary`.
// Each test names the code whose removal makes it fail. No network: the seam answers from its fixture.
import { describe, expect, test as bunTest } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { getDaily, getPaymentSettings, getProfile, listPeople, SALARY_PEOPLE_SOURCE } from "@/services/salary-people.service";
import { canOpen, menuFor } from "@/lib/roles/pages";
import { PeopleBody } from "./People";
import { PersonBody } from "./Person";
import { SettingsBody } from "./Settings";
import { DailyBody } from "./Daily";

// TASK-862's tests pin the screens on the FIXTURE; TASK-869 wired the seam to the API, so this file flips every function back (and restores them). The API paths are pinned in salary-869.test.tsx.
/** every test of this file runs with the seam on the fixture, and puts the switches back after (a later file in the same process sees the real ones). */
const test = (name: string, fn: () => void | Promise<void>) =>
  bunTest(name, async () => {
    const saved = { ...SALARY_PEOPLE_SOURCE };
    for (const k of Object.keys(SALARY_PEOPLE_SOURCE) as (keyof typeof SALARY_PEOPLE_SOURCE)[]) SALARY_PEOPLE_SOURCE[k] = "fixture";
    try {
      await fn();
    } finally {
      Object.assign(SALARY_PEOPLE_SOURCE, saved);
    }
  });
const days = async () => (await Promise.all(["2026-10-13", "2026-10-14"].map((d) => getDaily(d, "ceo")))) as NonNullable<Awaited<ReturnType<typeof getDaily>>>[];
const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const noop = () => {};
const menuLabels = (role: "ceo" | "admin" | "coach") => menuFor(role).flatMap((g) => g.items.map((i) => i.label));

describe("R0 at the data seam — hidden, never masked", () => {
  test("an Admin's Employee list carries no base salary; the CEO's does (listPeople)", async () => {
    expect((await listPeople("admin")).every((p) => !("baseSatang" in p))).toBe(true);
    expect((await listPeople("ceo")).every((p) => typeof p.baseSatang === "number")).toBe(true);
  });
  test("an Admin's profile carries neither the base salary nor the Freelance Rate, even for Ton who has both (getProfile)", async () => {
    const admin = await getProfile("Ton", "admin");
    expect(admin).not.toBeNull();
    expect("baseSatang" in (admin as object)).toBe(false);
    expect("rates" in (admin as object)).toBe(false);
    const ceo = await getProfile("Ton", "ceo");
    expect(ceo?.baseSatang).toBe(800_000);
    expect(ceo?.rates?.length).toBe(5);
  });
  test("Payment Setting and the Daily report answer nothing to a non-CEO", async () => {
    expect(await getPaymentSettings("admin")).toBeNull();
    expect(await getDaily("2026-10-14", "admin")).toBeNull();
    expect((await getPaymentSettings("ceo"))?.schools.length).toBe(5);
  });
  test("an unknown name is null, not a made-up profile", async () => {
    expect(await getProfile("Nobody", "ceo")).toBeNull();
  });
});

describe("Employee", () => {
  test("Admin: no Base salary column and no amount; CEO: the column and 20,800 ฿ (the `role === ceo` column + the seam)", async () => {
    const admin = ui(<PeopleBody people={await listPeople("admin")} role="admin" onOpen={noop} />);
    expect(admin).not.toContain("Base salary");
    expect(admin).not.toContain("20,800");
    const ceo = ui(<PeopleBody people={await listPeople("ceo")} role="ceo" onOpen={noop} />);
    expect(ceo).toContain("Base salary");
    expect(ceo).toContain("20,800 ฿");
  });
  test("REQ-5010: the header button reads «Add» and the vehicle reads «Motorcycle» (never «Motorbike»)", async () => {
    const html = ui(<PeopleBody people={await listPeople("ceo")} role="ceo" onOpen={noop} />);
    expect(html).toMatch(/>Add<\/span>|>Add<\/button>/);
    expect(html).not.toContain("Add employee"); // the modal is closed
    expect(html).toContain("Motorcycle");
    expect(html).not.toContain("Motorbike");
  });
});

describe("Employee Profile", () => {
  test("Admin sees Type · Merit · Bonus · Commission · Vehicle and neither pay row", async () => {
    const profile = (await getProfile("Ton", "admin"))!;
    const html = ui(<PersonBody profile={profile} options={[{ value: "Ton", label: "Ton" }]} onPick={noop} onBack={noop} />);
    for (const k of ["Merit", "Bonus", "Commission", "Vehicle"]) expect(html).toContain(k);
    expect(html).not.toContain("Base salary");
    expect(html).not.toContain("Freelance Rate");
    expect(html).not.toContain("8,000");
  });
  test("CEO sees both, the rates as «Private 300 ฿/Hr» badges, and the role-by-day row; the vehicle reads «Motorcycle»", async () => {
    const ton = ui(<PersonBody profile={(await getProfile("Ton", "ceo"))!} options={[{ value: "Ton", label: "Ton" }]} onPick={noop} onBack={noop} />);
    expect(ton).toContain("Base salary");
    expect(ton).toContain("8,000 ฿");
    expect(ton).toContain("Private 300 ฿/Hr");
    expect(ton).toContain("Sun");
    const may = ui(<PersonBody profile={(await getProfile("May", "ceo"))!} options={[{ value: "May", label: "May" }]} onPick={noop} onBack={noop} />);
    expect(may).toContain("Motorcycle");
    expect(may).not.toContain("Motorbike");
  });
});

describe("Payment Setting", () => {
  test("REQ-5010: ฟูลไทม์ (not ฟลูไทม์) in the Full-time sentence; Motorcycle in Transportation", async () => {
    const html = ui(<SettingsBody settings={(await getPaymentSettings("ceo"))!} />);
    expect(html).toContain("ครูฟูลไทม์");
    expect(html).not.toContain("ฟลูไทม์");
    expect(html).toContain("Motorcycle");
    expect(html).not.toContain("Motorbike");
  });
  test("REQ-5010: «Add school» is inside the School Distance box, not in the page header", async () => {
    const html = ui(<SettingsBody settings={(await getPaymentSettings("ceo"))!} />);
    const box = html.indexOf("School Distance");
    expect(box).toBeGreaterThan(-1);
    expect(html.indexOf("Add school")).toBeGreaterThan(box);
    expect(html.indexOf("Add school")).toBe(html.lastIndexOf("Add school")); // one button (the modal is closed)
    expect(html.indexOf("Save settings")).toBeLessThan(box);
  });
  test("every card of the final UI is there: Extra Hour · OT · Bonus 50 · Bonus 100 · Commission · Transportation · School Distance", async () => {
    const html = ui(<SettingsBody settings={(await getPaymentSettings("ceo"))!} />);
    for (const t of ["Extra Hour", "OT", "Bonus 50", "Bonus 100", "Commission", "Transportation", "School Distance", "350 ฿ per hour", "Salary ÷ 26 ÷ 8 × 1.15", "6 ฿", "40 ฿"]) expect(html).toContain(t);
  });
});

describe("Daily Training Report", () => {
  test("opens the newest day; totals are the SUM of the rows (12 Hr · 1,350 ฿ · 3 coaches); dates dd/mm/yy", async () => {
    const html = ui(<DailyBody dates={["2026-10-13", "2026-10-14"]} day="2026-10-14" onDay={noop} report={(await days())[1]} onBack={noop} />);
    expect(html).toContain("14/10/26 (Wed)");
    expect(html).toContain("Total · 3 coaches");
    expect(html).toContain("12 Hr");
    expect(html).toContain("1,350 ฿");
    expect(html).toContain("13/10/26"); // the other day's tab
  });
  test("Export is a visible button that is NOT a fake download (no link, no download attribute)", async () => {
    const html = ui(<DailyBody dates={["2026-10-13", "2026-10-14"]} day="2026-10-14" onDay={noop} report={(await days())[1]} onBack={noop} />);
    expect(html).toContain("Export");
    expect(html).not.toContain("download=");
    expect(html).not.toMatch(/<a [^>]*Export/);
  });
});

describe("who sees what in the menu (PAGE_RULES — the first match wins)", () => {
  test("Admin: Employee yes; Payment Setting and Daily Training Report no; the profile opens but is not listed", () => {
    const labels = menuLabels("admin");
    expect(labels).toContain("Employee");
    expect(labels).not.toContain("Payment Setting");
    expect(labels).not.toContain("Daily Training Report");
    expect(labels).not.toContain("Employee Profile");
    expect(canOpen("admin", "/salary/person")).toBe(true);
    expect(canOpen("admin", "/salary/settings")).toBe(false);
    expect(canOpen("admin", "/salary/daily")).toBe(false);
  });
  test("CEO: all three listed, and the hidden profile opens; Coach: none of the four", () => {
    const labels = menuLabels("ceo");
    for (const l of ["Employee", "Payment Setting", "Daily Training Report"]) expect(labels).toContain(l);
    expect(canOpen("ceo", "/salary/person")).toBe(true);
    for (const p of ["/salary/people", "/salary/person", "/salary/settings", "/salary/daily"]) expect(canOpen("coach", p)).toBe(false);
  });
});

describe("the seam", () => {
  test("the rules stay on the fixture, and no component imports the fixture (only the service does)", () => {
    expect(SALARY_PEOPLE_SOURCE.settingsRules).toBe("fixture");
    const dir = "src/components/partials/Salary";
    for (const f of readdirSync(dir).filter((x) => /\.(tsx?|ts)$/.test(x) && !/\.test\.tsx?$/.test(x))) {
      expect(readFileSync(`${dir}/${f}`, "utf8")).not.toContain("__fixtures__");
    }
  });
  test("the owner's files are untouched by the new service: it does not import Fern's salary.service", () => {
    expect(readFileSync("src/services/salary-people.service.ts", "utf8")).not.toContain("salary.service");
  });
});
