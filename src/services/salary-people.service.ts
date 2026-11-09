// The data seam of Team B's SALARY screens (Employee · Employee Profile · Payment Setting · Daily Training Report).
// TASK-862 built it on the fixture; TASK-869 wires it per function (SALARY_PEOPLE_SOURCE below) to SPEC-100 §5 / SPEC-102 §5-E3 / TASK-868 / TASK-885.
// 🔴 R0 lives HERE, not in the component: an Admin's answer never carries the base salary, the Freelance Rate, the vehicle or the type (hidden, never masked).
// 💰 Money over HTTP is integer satang; nothing here does float maths on it.
import { api, ApiClientError } from "@/lib/api/client";
import { bahtInputToSatang } from "@/components/partials/Salary/money";
import { DAILY_FIXTURE, PEOPLE_FIXTURE, PROFILES_FIXTURE, SETTINGS_FIXTURE } from "@/services/__fixtures__/salary-people";
import type { Role } from "@/types/app/roles";
import {
  FL_CLASSES,
  VEHICLE_LABEL,
  type ClassType,
  type DailyDay,
  type DailyRow,
  type EmploymentType,
  type FlChange,
  type FlRateRow,
  type FlSaveResult,
  type PaymentSettings,
  type PersonProfile,
  type PersonRow,
  type ProfileEdit,
  type School,
  type Vehicle,
} from "@/types/app/salary-people";

type Source = "fixture" | "api";
/**
 * Flipped per function, never globally.
 *  - `people` · `profile` · `schools` · `daily` are wired (profile routes TASK-871, transport/schools TASK-868, GET /salary/daily TASK-885).
 *  - `settingsRules` stays on the fixture: Extra Hour · OT · Bonus 50/100 · the commission-group table · the per-km rates have NO route yet (a gap, reported to Silver).
 */
export const SALARY_PEOPLE_SOURCE: Record<"people" | "profile" | "schools" | "daily" | "settingsRules", Source> = {
  people: "api",
  profile: "api",
  schools: "api",
  daily: "api",
  settingsRules: "fixture",
};

const BASE = "/v1/salary";
const answer = <T>(v: T): Promise<T> => Promise.resolve(structuredClone(v));

// ───────────────────────────── wire shapes (SPEC-100 §5, SPEC-102 §5-E3, TASK-868, TASK-885) ─────────────────────────────
interface WireProfile {
  teacherId: string;
  employmentType: EmploymentType;
  roles: EmploymentType[];
  baseSalary: number | null;
  active: boolean;
  meritEligible: boolean;
  vehicle: "car" | "motorbike" | null;
}
interface WirePerson {
  teacherId: string;
  name: string;
  isSystem?: boolean;
  meritEligible?: boolean;
}
interface WireFlRate {
  classType: string;
  rate: number;
}
interface WireSchool {
  id: string;
  name: string;
  distanceKm: number;
  active: boolean;
}
interface WireDaily {
  date: string;
  weekday: string;
  rows: { teacherId: string; role: string; hours: number; minutes: number; description: string; incomeSatang: number | null }[];
  totals: { coaches: number; minutes: number; incomeSatang: number };
}

const ROLE_WORD: Record<EmploymentType, string> = { FT: "Full-time", PT: "Part-time", FL: "Freelance", STAFF: "STAFF" };
const CLASS_WORD: Record<string, string> = { private: "Private", duo: "Duo", group: "Group", eca: "ECA", camp: "Camp" };
const CLASS_ORDER = ["private", "duo", "group", "eca", "camp"];

/** 30000 → "300", 30050 → "300.50": integer division and remainder, never a float. */
export function satangToBahtText(satang: number): string {
  const abs = Math.abs(satang);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${satang < 0 ? "-" : ""}${whole}${cents ? `.${String(cents).padStart(2, "0")}` : ""}`;
}

export const vehicleOf = (v: "car" | "motorbike" | null): Vehicle => v ?? "none";
const wireVehicle = (v: Vehicle): "car" | "motorbike" | null => (v === "none" ? null : v);
/** Roles held (never empty from the server) → the screen's words; a lone role is just that role. */
const typeWords = (p: Pick<WireProfile, "employmentType" | "roles">): string[] => (p.roles.length ? p.roles : [p.employmentType]).map((r) => ROLE_WORD[r]);
const meritWord = (yes: boolean | undefined): string => (yes ? "Yes" : "No");

/** The names the profile / daily answers do not carry: the ACTIVE people with a teacher row, never "No Teacher" (`is_system`). CEO and Admin may read it (no pay in it). */
async function namedPeople(): Promise<WirePerson[]> {
  const { data } = await api.get<WirePerson[]>(`${BASE}/entries/people`);
  return (data ?? []).filter((p) => !p.isSystem);
}

// ───────────────────────────── the reads ─────────────────────────────

/**
 * The Employee list.
 *  - CEO: every profile whose person has a name (an inactive profile, or one with no teacher row, has none and is left out).
 *  - Admin: the profile routes are CEO-only, so an Admin's list is the names + the merit flag from the admin-safe people list; no type, no vehicle, no base.
 */
export async function listPeople(role: Role): Promise<PersonRow[]> {
  if (SALARY_PEOPLE_SOURCE.people === "fixture") {
    return answer(PEOPLE_FIXTURE.map((p) => (role === "ceo" ? p : { name: p.name, types: p.types, vehicle: p.vehicle, merit: p.merit })));
  }
  const people = await namedPeople();
  if (role !== "ceo") return people.map((p) => ({ teacherId: p.teacherId, name: p.name, merit: meritWord(p.meritEligible) }));
  const { data: profiles } = await api.get<WireProfile[]>(`${BASE}/profiles`);
  const byId = new Map((profiles ?? []).map((p) => [p.teacherId, p]));
  return people
    .filter((p) => byId.has(p.teacherId))
    .map((p) => {
      const pr = byId.get(p.teacherId) as WireProfile;
      return { teacherId: p.teacherId, name: p.name, types: typeWords(pr), vehicle: vehicleOf(pr.vehicle), baseSatang: pr.baseSalary ?? undefined, merit: meritWord(pr.meritEligible) };
    });
}

/** One person's profile (by NAME on the fixture, by TEACHER ID on the API), or null. An Admin's answer has the name and the merit flag only. */
export async function getProfile(who: string, role: Role): Promise<PersonProfile | null> {
  if (SALARY_PEOPLE_SOURCE.profile === "fixture") {
    const p = PROFILES_FIXTURE[who];
    if (!p) return answer(null);
    const { baseSatang: _base, rates: _rates, ...rest } = p;
    return answer({ name: who, ...(role === "ceo" ? p : rest) });
  }
  const person = (await namedPeople()).find((p) => p.teacherId === who);
  if (!person) return null;
  if (role !== "ceo") return { teacherId: who, name: person.name, merit: meritWord(person.meritEligible) };
  const { data: profiles } = await api.get<WireProfile[]>(`${BASE}/profiles`);
  const pr = (profiles ?? []).find((p) => p.teacherId === who);
  if (!pr) return null;
  const isFl = pr.roles.includes("FL") || pr.employmentType === "FL";
  // The Freelance Rate is read only for a person who holds the Freelance role (the route answers [] otherwise).
  const rates = isFl ? (await api.get<WireFlRate[]>(`${BASE}/profiles/${who}/fl-rates`)).data : [];
  const rateText = [...(rates ?? [])]
    .sort((a, b) => CLASS_ORDER.indexOf(a.classType) - CLASS_ORDER.indexOf(b.classType))
    .map((r) => `${CLASS_WORD[r.classType] ?? r.classType} ${satangToBahtText(r.rate)}`);
  return {
    teacherId: who,
    name: person.name,
    type: typeWords(pr).join(" + "),
    vehicle: vehicleOf(pr.vehicle),
    baseSatang: pr.baseSalary ?? undefined,
    rates: isFl ? rateText : null,
    // TASK-899: the five class types in order for the editor; a class with no rate yet is null (empty on screen, never 0)
    ...(isFl ? { flRates: FL_CLASSES.map<FlRateRow>((c) => ({ ...c, rateSatang: (rates ?? []).find((r) => r.classType === c.classType)?.rate ?? null })) } : {}),
    merit: meritWord(pr.meritEligible),
    raw: { employmentType: pr.employmentType, roles: pr.roles, active: pr.active, meritEligible: pr.meritEligible },
  };
}

/** What a rate box holds → "empty" (leave unset), a whole-satang amount, or "invalid". A number ≥ 0 with at most 2 decimals; text is parsed, never multiplied as a float. */
export function parseRateText(text: string): "empty" | "invalid" | { satang: number } {
  const t = text.trim();
  if (t === "") return "empty";
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return "invalid";
  const s = bahtInputToSatang(t);
  return s === null ? "invalid" : { satang: s };
}

/** Only the boxes that CHANGED and hold a valid amount are sent. An emptied box sends nothing (there is no «delete a rate» route); an invalid one is reported. */
export function planFlSaves(initial: Record<ClassType, string>, current: Record<ClassType, string>): { changes: FlChange[]; invalid: ClassType[] } {
  const changes: FlChange[] = [];
  const invalid: ClassType[] = [];
  for (const { classType } of FL_CLASSES) {
    if (current[classType].trim() === initial[classType].trim()) continue;
    const p = parseRateText(current[classType]);
    if (p === "empty") continue;
    if (p === "invalid") invalid.push(classType);
    else changes.push({ classType, rateSatang: p.satang });
  }
  return { changes, invalid };
}

/** One PUT per change, in order; a failure does not stop the rest, and says which class failed (the caller re-reads, so the screen shows the truth). CEO-only route. */
export async function saveFlRates(teacherId: string, changes: FlChange[]): Promise<FlSaveResult[]> {
  const out: FlSaveResult[] = [];
  for (const c of changes) {
    try {
      await api.put(`${BASE}/profiles/${teacherId}/fl-rates/${c.classType}`, { rate: c.rateSatang });
      out.push({ classType: c.classType, ok: true });
    } catch (e) {
      out.push({ classType: c.classType, ok: false, message: e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : "—" });
    }
  }
  return out;
}

/** The CEO edits base salary · vehicle · merit. The rest of the stored profile goes back unchanged (`roles` as held). Resolves with the saved profile. */
export async function saveProfile(teacherId: string, current: NonNullable<PersonProfile["raw"]>, edit: ProfileEdit): Promise<void> {
  if (SALARY_PEOPLE_SOURCE.profile === "fixture") return;
  await api.put(`${BASE}/profiles/${teacherId}`, {
    employmentType: current.employmentType,
    baseSalary: edit.baseSatang,
    active: current.active,
    roles: current.roles,
    meritEligible: edit.meritEligible,
    vehicle: wireVehicle(edit.vehicle),
  });
}

/**
 * Payment Setting (CEO only). The rule cards, the commission table and the per-km rates come from the fixture (no route); the School Distance list is live.
 */
export async function getPaymentSettings(role: Role): Promise<PaymentSettings | null> {
  if (role !== "ceo") return null;
  const rules = structuredClone(SETTINGS_FIXTURE);
  if (SALARY_PEOPLE_SOURCE.schools === "fixture") return rules;
  const { data } = await api.get<WireSchool[]>(`${BASE}/transport/schools`);
  return { ...rules, schools: (data ?? []).filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, km: s.distanceKm })) };
}

export async function addSchool(name: string, km: number): Promise<School> {
  const { data } = await api.post<WireSchool>(`${BASE}/transport/schools`, { name, distanceKm: km });
  return { id: data.id, name: data.name, km: data.distanceKm };
}

export async function updateSchoolKm(id: string, km: number): Promise<School> {
  const { data } = await api.put<WireSchool>(`${BASE}/transport/schools/${id}`, { distanceKm: km });
  return { id: data.id, name: data.name, km: data.distanceKm };
}

/** One day of the Daily Training Report (CEO only), the coach names joined from the people list. */
export async function getDaily(date: string, role: Role): Promise<DailyDay | null> {
  if (role !== "ceo") return null;
  if (SALARY_PEOPLE_SOURCE.daily === "fixture") return answer(DAILY_FIXTURE.find((d) => d.date === date) ?? null);
  const [{ data }, people] = await Promise.all([api.get<WireDaily>(`${BASE}/daily`, { params: { date } }), namedPeople()]);
  const names = new Map(people.map((p) => [p.teacherId, p.name]));
  const rows: DailyRow[] = (data.rows ?? [])
    .filter((r) => names.has(r.teacherId)) // a person with no name (or "No Teacher") is never a row
    .map((r) => ({ coach: names.get(r.teacherId) as string, role: r.role, hours: r.hours, description: r.description, incomeSatang: r.incomeSatang }));
  return { date: data.date, weekday: data.weekday, rows };
}

/** The dates the report offers as tabs: the fixture's two days, or the last 7 days ending `today` (YYYY-MM-DD, Bangkok), oldest first. */
export function dailyTabDates(today: string): string[] {
  if (SALARY_PEOPLE_SOURCE.daily === "fixture") return DAILY_FIXTURE.map((d) => d.date).sort();
  const base = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => new Date(base.getTime() - (6 - i) * 86_400_000).toISOString().slice(0, 10));
}

export { VEHICLE_LABEL };
