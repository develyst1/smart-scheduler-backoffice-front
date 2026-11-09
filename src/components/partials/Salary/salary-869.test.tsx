// TASK-869 — People · Person · Settings · Daily wired to the real routes (SPEC-100 §5 / SPEC-102 §5-E3 / TASK-868 / TASK-885). Run: `bun test src/components/partials/Salary`.
// No network: axios gets a recording adapter. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import { addSchool, dailyTabDates, getDaily, getPaymentSettings, getProfile, listPeople, saveProfile, satangToBahtText, SALARY_PEOPLE_SOURCE, updateSchoolKm } from "@/services/salary-people.service";
import { readFileSync } from "node:fs";
import { PeopleBody, profileHref } from "./People";
import { PersonBody } from "./Person";
import { SettingsBody } from "./Settings";
import type { PersonProfile } from "@/types/app/salary-people";

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
const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const noop = () => {};
const urls = (seen: InternalAxiosRequestConfig[]) => seen.map((c) => `${(c.method ?? "get").toUpperCase()} ${c.url}`);

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const SYS = "99999999-9999-4999-8999-999999999999";
const PEOPLE_WIRE = [
  { teacherId: T1, name: "ต้น", meritEligible: true },
  { teacherId: T2, name: "พลอย", meritEligible: false },
  { teacherId: SYS, name: "No Teacher", isSystem: true, meritEligible: false },
];
const PROFILES_WIRE = [
  { teacherId: T1, employmentType: "PT", roles: ["PT", "FL"], baseSalary: 800_000, active: true, meritEligible: true, vehicle: "motorbike" },
  { teacherId: T2, employmentType: "STAFF", roles: ["STAFF"], baseSalary: 1_500_000, active: true, meritEligible: false, vehicle: null },
  { teacherId: "33333333-3333-4333-8333-333333333333", employmentType: "FT", roles: ["FT"], baseSalary: 2_000_000, active: false, meritEligible: false, vehicle: "car" }, // no name ⇒ left out
];
const route = (c: InternalAxiosRequestConfig) => `${(c.method ?? "get").toUpperCase()} ${c.url}`;
const answers = (c: InternalAxiosRequestConfig): { status: number; data: unknown } => {
  const r = route(c);
  if (r === "GET /v1/salary/entries/people") return { status: 200, data: PEOPLE_WIRE };
  if (r === "GET /v1/salary/profiles") return { status: 200, data: PROFILES_WIRE };
  if (r === `GET /v1/salary/profiles/${T1}/fl-rates`) return { status: 200, data: [{ classType: "eca", rate: 40_000 }, { classType: "private", rate: 30_050 }] };
  if (r.startsWith("PUT /v1/salary/profiles/")) return { status: 200, data: { ...PROFILES_WIRE[0], ...(c.data ? JSON.parse(String(c.data)) : {}) } };
  if (r === "GET /v1/salary/transport/schools") return { status: 200, data: [{ id: "s1", name: "STA", distanceKm: 12, active: true }, { id: "s2", name: "OLD", distanceKm: 3, active: false }] };
  if (r === "POST /v1/salary/transport/schools") return { status: 201, data: { id: "s3", name: "NIS", distanceKm: 18, active: true } };
  if (r === "PUT /v1/salary/transport/schools/s1") return { status: 200, data: { id: "s1", name: "STA", distanceKm: 14, active: true } };
  if (r === "GET /v1/salary/daily")
    return {
      status: 200,
      data: {
        date: "2026-10-14",
        weekday: "Wed",
        rows: [
          { teacherId: T1, role: "Freelance", hours: 1.25, minutes: 75, description: "Private 1.25 Hr × 300", incomeSatang: 37_500 },
          { teacherId: "44444444-4444-4444-8444-444444444444", role: "Full-time", hours: 4, minutes: 240, description: "—", incomeSatang: null }, // no name ⇒ never a row
        ],
        totals: { coaches: 2, minutes: 315, incomeSatang: 37_500 },
      },
    };
  return { status: 404, data: {} };
};

describe("the profile link", () => {
  test("Open goes to /salary/person?teacherId=<id> (TASK-869 § GO), and the page reads that same parameter", () => {
    expect(profileHref(T1)).toBe(`/salary/person?teacherId=${T1}`);
    expect(readFileSync("src/components/partials/Salary/Person.tsx", "utf8")).toContain('useSearchParams().get("teacherId")');
  });
});

describe("the switches", () => {
  test("People · Profile · Schools · Daily are on the API; only the rule cards stay on the fixture (settingsRules)", () => {
    expect(SALARY_PEOPLE_SOURCE).toEqual({ people: "api", profile: "api", schools: "api", daily: "api", settingsRules: "fixture" });
  });
});

describe("Employee list from the API (listPeople)", () => {
  test("CEO: profiles + names joined; «No Teacher» and a profile with no name are left out; types / vehicle / merit / base mapped", async () => {
    const seen = stub(answers);
    const rows = await listPeople("ceo");
    expect(urls(seen).sort()).toEqual(["GET /v1/salary/entries/people", "GET /v1/salary/profiles"]);
    expect(rows.map((r) => r.name)).toEqual(["ต้น", "พลอย"]);
    expect(rows[0]).toEqual({ teacherId: T1, name: "ต้น", types: ["Part-time", "Freelance"], vehicle: "motorbike", baseSatang: 800_000, merit: "Yes" });
    expect(rows[1]).toMatchObject({ types: ["STAFF"], vehicle: "none", merit: "No" });
  });
  test("Admin: the profile routes (CEO-only) are NEVER requested; the rows carry the name and merit flag, no pay, type or vehicle", async () => {
    const seen = stub(answers);
    const rows = await listPeople("admin");
    expect(urls(seen)).toEqual(["GET /v1/salary/entries/people"]);
    expect(rows).toEqual([
      { teacherId: T1, name: "ต้น", merit: "Yes" },
      { teacherId: T2, name: "พลอย", merit: "No" },
    ]);
    for (const r of rows) for (const k of ["baseSatang", "types", "vehicle"]) expect(k in r).toBe(false);
  });
});

describe("Employee Profile from the API (getProfile)", () => {
  test("CEO: base in satang, the FL rates in class order with a 30,050-satang rate as «300.50», roles as words, `raw` for the save", async () => {
    stub(answers);
    const p = (await getProfile(T1, "ceo")) as PersonProfile;
    expect(p).toMatchObject({ teacherId: T1, name: "ต้น", type: "Part-time + Freelance", baseSatang: 800_000, vehicle: "motorbike", merit: "Yes" });
    expect(p.rates).toEqual(["Private 300.50", "ECA 400"]);
    expect(p.raw).toEqual({ employmentType: "PT", roles: ["PT", "FL"], active: true, meritEligible: true });
    expect(satangToBahtText(30_000)).toBe("300");
  });
  test("a person with no Freelance role shows no rate row (rates: null)", async () => {
    stub(answers);
    expect(((await getProfile(T2, "ceo")) as PersonProfile).rates).toBeNull();
  });
  test("Admin: only the name and merit — neither /profiles nor /fl-rates is requested", async () => {
    const seen = stub(answers);
    const p = (await getProfile(T1, "admin")) as PersonProfile;
    expect(urls(seen)).toEqual(["GET /v1/salary/entries/people"]);
    expect(p).toEqual({ teacherId: T1, name: "ต้น", merit: "Yes" });
  });
  test("an unknown id (or «No Teacher») is null", async () => {
    stub(answers);
    expect(await getProfile(SYS, "ceo")).toBeNull();
    expect(await getProfile("nobody", "ceo")).toBeNull();
  });
});

describe("the save (saveProfile)", () => {
  test("PUT body: base in integer satang, vehicle «motorbike»→motorbike, «none»→null, the stored roles / type / active go back unchanged", async () => {
    const seen = stub(answers);
    const raw = { employmentType: "PT", roles: ["PT", "FL"], active: true, meritEligible: true } as const;
    await saveProfile(T1, { ...raw, roles: [...raw.roles] }, { baseSatang: 812_550, vehicle: "motorbike", meritEligible: false });
    await saveProfile(T1, { ...raw, roles: [...raw.roles] }, { baseSatang: null, vehicle: "none", meritEligible: true });
    expect(urls(seen)).toEqual([`PUT /v1/salary/profiles/${T1}`, `PUT /v1/salary/profiles/${T1}`]);
    expect(JSON.parse(String(seen[0].data))).toEqual({ employmentType: "PT", baseSalary: 812_550, active: true, roles: ["PT", "FL"], meritEligible: false, vehicle: "motorbike" });
    expect(JSON.parse(String(seen[1].data))).toMatchObject({ baseSalary: null, vehicle: null, meritEligible: true });
  });
  test("a refusal reaches the caller (the screen shows the server's sentence)", async () => {
    stub(() => ({ status: 400, data: { error: { code: "VALIDATION", message: "roles: bad" } } }));
    await expect(saveProfile(T1, { employmentType: "PT", roles: ["PT"], active: true, meritEligible: false }, { baseSatang: 1, vehicle: "none", meritEligible: false })).rejects.toBeTruthy();
  });
});

describe("Payment Setting", () => {
  test("the School Distance list is the server's active schools; the rule cards are the fixture's", async () => {
    stub(answers);
    const s = (await getPaymentSettings("ceo"))!;
    expect(s.schools).toEqual([{ id: "s1", name: "STA", km: 12 }]);
    expect(s.cards.map((c) => c.title)).toContain("Extra Hour");
    expect(await getPaymentSettings("admin")).toBeNull();
  });
  test("Add school POSTs name + distanceKm; Edit PUTs the km to the school's id", async () => {
    const seen = stub(answers);
    expect(await addSchool("NIS", 18)).toEqual({ id: "s3", name: "NIS", km: 18 });
    expect(await updateSchoolKm("s1", 14)).toEqual({ id: "s1", name: "STA", km: 14 });
    expect(JSON.parse(String(seen[0].data))).toEqual({ name: "NIS", distanceKm: 18 });
    expect(urls(seen)).toEqual(["POST /v1/salary/transport/schools", "PUT /v1/salary/transport/schools/s1"]);
  });
  test("live: «Add group» and «Save settings» (nothing to save yet) are NOT drawn; «Add school» is; not live: all three", async () => {
    stub(answers);
    const settings = (await getPaymentSettings("ceo"))!;
    const live = ui(<SettingsBody settings={settings} live />);
    expect(live).not.toContain("Add group");
    expect(live).not.toContain("Save settings");
    expect(live).toContain("Add school");
    const fixture = ui(<SettingsBody settings={settings} live={false} />);
    for (const w of ["Add group", "Save settings", "Add school"]) expect(fixture).toContain(w);
  });
});

describe("Daily Training Report from the API (getDaily)", () => {
  test("the coach name is joined from the people list; a teacher with no name is never a row; the CEO only", async () => {
    const seen = stub(answers);
    const d = (await getDaily("2026-10-14", "ceo"))!;
    expect(d.rows).toEqual([{ coach: "ต้น", role: "Freelance", hours: 1.25, description: "Private 1.25 Hr × 300", incomeSatang: 37_500 }]);
    expect(seen.find((c) => c.url === "/v1/salary/daily")?.params).toEqual({ date: "2026-10-14" });
    expect(await getDaily("2026-10-14", "admin")).toBeNull();
  });
  test("the tabs are the last 7 days ending today, oldest first", () => {
    expect(dailyTabDates("2026-10-14")).toEqual(["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"]);
  });
});

describe("what each role's screen draws", () => {
  test("Admin's Employee: Name + Merit only — no Type, Vehicle, Base salary or Open; and no Add (no route)", async () => {
    stub(answers);
    const html = ui(<PeopleBody people={await listPeople("admin")} role="admin" onOpen={noop} />);
    expect(html).toContain("ต้น");
    for (const w of ["Type", "Vehicle", "Base salary", "Open", "8,000"]) expect(html).not.toContain(w);
    expect(html).toContain("Merit");
    expect(html).not.toMatch(/>Add<\/span>|>Add<\/button>/);
  });
  test("CEO's Employee: the Open button and the base in baht; no Add either (the API has no create)", async () => {
    stub(answers);
    const html = ui(<PeopleBody people={await listPeople("ceo")} role="ceo" onOpen={noop} />);
    expect(html).toContain("Open");
    expect(html).toContain("8,000 ฿");
    expect(html).toContain("Motorcycle");
    expect(html).not.toContain("Motorbike");
    expect(html).not.toMatch(/>Add<\/span>|>Add<\/button>/);
  });
  test("CEO's profile edits Base salary · Merit · Vehicle in place and shows «Save profile»; the rate badges read «Private 300.50 ฿/Hr»", async () => {
    stub(answers);
    const p = (await getProfile(T1, "ceo")) as PersonProfile;
    const html = ui(<PersonBody profile={p} options={[{ value: T1, label: "ต้น" }]} onPick={noop} onBack={noop} onSave={noop} />);
    expect(html).toContain('aria-label="Base salary"');
    expect(html).toContain('aria-label="Merit"');
    expect(html).toContain('aria-label="Vehicle"');
    expect(html).toContain("Save profile");
    // 🔻 TASK-899: the rate badges became the editor (one box per class type); the badge text path remains for a read-only card
    expect(html).toContain("data-fl-editor");
    expect(html).toContain('value="300.50 ฿/Hr"');
    expect(html).not.toContain("Bonus"); // not in the profile API ⇒ not drawn, never invented
    expect(html).not.toContain("Commission");
  });
  test("Admin's profile: the name and Merit only — no pay row, no Save", async () => {
    stub(answers);
    const p = (await getProfile(T1, "admin")) as PersonProfile;
    const html = ui(<PersonBody profile={p} options={[{ value: T1, label: "ต้น" }]} onPick={noop} onBack={noop} />);
    expect(html).toContain("Merit");
    for (const w of ["Base salary", "Freelance Rate", "Vehicle", "Save profile", "8,000"]) expect(html).not.toContain(w);
  });
});
