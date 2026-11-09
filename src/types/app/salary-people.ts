// TASK-862 — Team B's SALARY screens: Employee · Employee Profile · Payment Setting · Daily Training Report.
// Money is whole satang (integers), like the rest of the salary code; it is printed as baht only at display. Staff and child names in the fixture are invented (CONVENTIONS §2.8).
/** Whole satang (100 satang = 1 baht), never a float. */
export type Satang = number;

/** The vehicle's VALUE. Its label is `VEHICLE_LABEL` (REQ-5010: «Motorcycle», label only — the value stays `motorbike`). */
export type Vehicle = "car" | "motorbike" | "none";
export const VEHICLE_LABEL: Record<Vehicle, string> = { car: "Car", motorbike: "Motorcycle", none: "—" };
export const VEHICLES: Vehicle[] = ["car", "motorbike", "none"];

export const STAFF_TYPES = ["Full-time", "Part-time", "Freelance", "STAFF"] as const;

/** One row of the Employee list. `baseSatang` is ABSENT for an Admin (R0: hidden, never masked) — the service does not send it. */
export interface PersonRow {
  /** the teacher id (the profile routes' key); absent only on the fixture rows' older shape */
  teacherId?: string;
  name: string;
  /** an Admin's row has no type and no vehicle: the profile routes are CEO-only, so they cannot be loaded (hidden, never masked) */
  types?: string[];
  vehicle?: Vehicle;
  baseSatang?: Satang;
  merit?: string;
}

/** The Employee Profile card. `baseSatang` and `rates` (the Freelance Rate) are ABSENT for an Admin. */
export interface PersonProfile {
  teacherId?: string;
  name: string;
  type?: string;
  vehicle?: Vehicle;
  baseSatang?: Satang;
  /** display strings, "Private 300" (a whole-baht rate prints without decimals) */
  rates?: string[] | null;
  merit: string;
  /** not in the profile API (TASK-871) ⇒ absent ⇒ the row is not drawn; the fixture still has them */
  bonus?: string;
  commission?: string;
  roleByDay?: ("Part-time" | "Freelance")[];
  /** TASK-899 — the five class types in order, for a CEO looking at a person who holds the FL role (API only): `null` = no rate set yet (shown empty, never 0) */
  flRates?: FlRateRow[];
  /** present only when the profile came from the API for the CEO: what `PUT /salary/profiles/:id` needs back, so the page can edit */
  raw?: ProfileRaw;
}

export type ClassType = "private" | "duo" | "group" | "eca" | "camp";
/** The final UI's class words (the same map as the back's TASK-885): «ECA», never «Eca». Order = the order they are shown. */
export const FL_CLASSES: { classType: ClassType; label: string }[] = [
  { classType: "private", label: "Private" },
  { classType: "duo", label: "Duo" },
  { classType: "group", label: "Group" },
  { classType: "eca", label: "ECA" },
  { classType: "camp", label: "Camp" },
];
export interface FlRateRow {
  classType: ClassType;
  label: string;
  rateSatang: Satang | null;
}
/** One PUT the page will send: a class type whose input changed to a valid amount. */
export interface FlChange {
  classType: ClassType;
  rateSatang: Satang;
}
export interface FlSaveResult {
  classType: ClassType;
  ok: boolean;
  /** the server's sentence when it refused */
  message?: string;
}

export type EmploymentType = "FT" | "PT" | "FL" | "STAFF";
/** The stored facts a save sends back unchanged (SPEC-102 §5-E3). */
export interface ProfileRaw {
  employmentType: EmploymentType;
  roles: EmploymentType[];
  active: boolean;
  meritEligible: boolean;
}
export interface ProfileEdit {
  baseSatang: Satang | null;
  vehicle: Vehicle;
  meritEligible: boolean;
}

export interface LabelledRows {
  title: string;
  rows: [string, string][];
}

export interface CommissionGroup {
  group: string;
  rate: string;
  ft: string;
  pt: string;
  fl: string;
  staff: string;
}

export interface School {
  /** the server's id; absent on a fixture row */
  id?: string;
  name: string;
  km: number;
}

export interface TransportRow {
  vehicle: Vehicle;
  perKmSatang: Satang;
  minimumSatang: Satang;
}

/** Payment Setting (CEO only). */
export interface PaymentSettings {
  cards: LabelledRows[];
  commissionGroups: CommissionGroup[];
  transport: TransportRow[];
  schools: School[];
}

export interface DailyRow {
  coach: string; // the name, joined on the screen's side from the people list (the report carries the teacher id)
  role: string;
  hours: number;
  description: string;
  incomeSatang: Satang | null;
}

export interface DailyDay {
  /** ISO date */
  date: string;
  weekday: string;
  rows: DailyRow[];
}
