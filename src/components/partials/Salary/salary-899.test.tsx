// TASK-899 — the Freelance Rate editor on Employee Profile (CEO only; `PUT /salary/profiles/:id/fl-rates/:classType {rate}` = integer satang per hour). Run: `bun test src/components/partials/Salary`.
// No network: axios gets a recording adapter. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import { getProfile, parseRateText, planFlSaves, saveFlRates } from "@/services/salary-people.service";
import { PersonBody } from "./Person";
import { FL_CLASSES, type ClassType, type PersonProfile } from "@/types/app/salary-people";

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

const FL = "11111111-1111-4111-8111-111111111111"; // PT + FL
const STAFF = "22222222-2222-4222-8222-222222222222"; // no FL role
const PEOPLE = [
  { teacherId: FL, name: "ต้น", meritEligible: true },
  { teacherId: STAFF, name: "พลอย", meritEligible: false },
];
const PROFILES = [
  { teacherId: FL, employmentType: "PT", roles: ["PT", "FL"], baseSalary: 800_000, active: true, meritEligible: true, vehicle: "car" },
  { teacherId: STAFF, employmentType: "STAFF", roles: ["STAFF"], baseSalary: 1_500_000, active: true, meritEligible: false, vehicle: null },
];
const answers = (c: InternalAxiosRequestConfig): { status: number; data: unknown } => {
  const r = `${(c.method ?? "get").toUpperCase()} ${c.url}`;
  if (r === "GET /v1/salary/entries/people") return { status: 200, data: PEOPLE };
  if (r === "GET /v1/salary/profiles") return { status: 200, data: PROFILES };
  if (r === `GET /v1/salary/profiles/${FL}/fl-rates`) return { status: 200, data: [{ classType: "eca", rate: 40_000 }, { classType: "private", rate: 30_000 }] }; // duo, group, camp unset
  if (r.startsWith(`PUT /v1/salary/profiles/${FL}/fl-rates/`)) return { status: 200, data: { classType: c.url?.split("/").pop(), rate: JSON.parse(String(c.data)).rate } };
  return { status: 404, data: {} };
};

const blank = (over: Partial<Record<ClassType, string>> = {}): Record<ClassType, string> => ({ private: "", duo: "", group: "", eca: "", camp: "", ...over });

describe("the five class words, in order", () => {
  test("Private · Duo · Group · ECA · Camp — «ECA», never «Eca» (FL_CLASSES)", () => {
    expect(FL_CLASSES.map((c) => c.label)).toEqual(["Private", "Duo", "Group", "ECA", "Camp"]);
    expect(FL_CLASSES.map((c) => c.classType)).toEqual(["private", "duo", "group", "eca", "camp"]);
  });
});

describe("what a rate box may hold (parseRateText)", () => {
  test("empty ⇒ nothing to send; «300» → 30000; «300.5» → 30050; «300.50» → 30050; «0» → 0 satang", () => {
    expect(parseRateText("  ")).toBe("empty");
    expect(parseRateText("300")).toEqual({ satang: 30_000 });
    expect(parseRateText("300.5")).toEqual({ satang: 30_050 });
    expect(parseRateText("300.50")).toEqual({ satang: 30_050 });
    expect(parseRateText("0")).toEqual({ satang: 0 });
  });
  test("negative, three decimals, letters, a comma are invalid — not silently rounded (the shared helper would truncate «1.999»)", () => {
    for (const bad of ["-1", "1.999", "abc", "1,5", "1.", ".5", "1e3"]) expect(parseRateText(bad)).toBe("invalid");
  });
});

describe("which boxes are sent (planFlSaves)", () => {
  test("only CHANGED boxes with a valid amount; an unchanged box is never sent", () => {
    const initial = blank({ private: "300", eca: "400" });
    const plan = planFlSaves(initial, blank({ private: "300", eca: "450.5", duo: "350" }));
    expect(plan.changes).toEqual([
      { classType: "duo", rateSatang: 35_000 },
      { classType: "eca", rateSatang: 45_050 },
    ]);
    expect(plan.invalid).toEqual([]);
  });
  test("an emptied box sends nothing (there is no delete route); an untouched empty box sends nothing", () => {
    expect(planFlSaves(blank({ private: "300" }), blank()).changes).toEqual([]);
    expect(planFlSaves(blank(), blank()).changes).toEqual([]);
  });
  test("an invalid box is reported and not sent", () => {
    const plan = planFlSaves(blank(), blank({ camp: "-5", group: "100" }));
    expect(plan.invalid).toEqual(["camp"]);
    expect(plan.changes).toEqual([{ classType: "group", rateSatang: 10_000 }]);
  });
});

describe("the saves (saveFlRates)", () => {
  test("one PUT per change, to the class type's own URL, body {rate} in integer satang, in order", async () => {
    const seen = stub(answers);
    const res = await saveFlRates(FL, [
      { classType: "duo", rateSatang: 35_000 },
      { classType: "eca", rateSatang: 45_050 },
    ]);
    expect(urls(seen)).toEqual([`PUT /v1/salary/profiles/${FL}/fl-rates/duo`, `PUT /v1/salary/profiles/${FL}/fl-rates/eca`]);
    expect(seen.map((c) => JSON.parse(String(c.data)))).toEqual([{ rate: 35_000 }, { rate: 45_050 }]);
    expect(res).toEqual([{ classType: "duo", ok: true }, { classType: "eca", ok: true }]);
  });
  test("no changes ⇒ no request at all", async () => {
    const seen = stub(answers);
    expect(await saveFlRates(FL, [])).toEqual([]);
    expect(seen).toEqual([]);
  });
  test("a 400 shows the SERVER's sentence for that class; the others still go, and the result says which failed", async () => {
    const seen = stub((c) =>
      c.url?.endsWith("/camp") ? { status: 400, data: { error: { code: "VALIDATION", message: "rate must be an integer ≥ 0 (satang per hour)" } } } : answers(c),
    );
    const res = await saveFlRates(FL, [
      { classType: "duo", rateSatang: 35_000 },
      { classType: "camp", rateSatang: 1 },
      { classType: "eca", rateSatang: 40_000 },
    ]);
    expect(seen.length).toBe(3);
    expect(res.map((r) => [r.classType, r.ok])).toEqual([["duo", true], ["camp", false], ["eca", true]]);
    expect(res[1].message).toContain("rate must be an integer");
  });
});

describe("who gets the editor", () => {
  test("a person who holds FL: the profile carries the five rows, a set rate in satang and an unset one as null (never 0)", async () => {
    stub(answers);
    const p = (await getProfile(FL, "ceo")) as PersonProfile;
    expect(p.flRates?.map((r) => [r.label, r.rateSatang])).toEqual([["Private", 30_000], ["Duo", null], ["Group", null], ["ECA", 40_000], ["Camp", null]]);
  });
  test("a person with no FL role: no flRates and no /fl-rates request", async () => {
    const seen = stub(answers);
    const p = (await getProfile(STAFF, "ceo")) as PersonProfile;
    expect(p.flRates).toBeUndefined();
    expect(urls(seen).some((u) => u.includes("fl-rates"))).toBe(false);
  });
  test("Admin: no editor data, and neither /profiles nor /fl-rates is requested", async () => {
    const seen = stub(answers);
    const p = (await getProfile(FL, "admin")) as PersonProfile;
    expect(p.flRates).toBeUndefined();
    expect(urls(seen).some((u) => u.includes("fl-rates") || u.endsWith("/profiles"))).toBe(false);
  });
  test("the CEO's card draws one box per class in order, empty for an unset rate; a non-FL CEO card and the Admin card draw none", async () => {
    stub(answers);
    const flCard = ui(<PersonBody profile={(await getProfile(FL, "ceo")) as PersonProfile} options={[{ value: FL, label: "ต้น" }]} onPick={noop} onBack={noop} onSave={noop} />);
    expect(flCard).toContain("data-fl-editor");
    const order = FL_CLASSES.map((c) => flCard.indexOf(`data-fl-input="${c.classType}"`));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(flCard).toContain("฿/Hr");
    const staff = ui(<PersonBody profile={(await getProfile(STAFF, "ceo")) as PersonProfile} options={[{ value: STAFF, label: "พลอย" }]} onPick={noop} onBack={noop} onSave={noop} />);
    expect(staff).not.toContain("data-fl-editor");
    const admin = ui(<PersonBody profile={(await getProfile(FL, "admin")) as PersonProfile} options={[{ value: FL, label: "ต้น" }]} onPick={noop} onBack={noop} />);
    expect(admin).not.toContain("data-fl-editor");
    expect(admin).not.toContain("Freelance Rate");
  });
});
