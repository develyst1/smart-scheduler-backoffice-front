// TASK-862 — the final UI's mock data for People · Person · Settings · Daily (final-ui/src/mock/a-salary.ts), moved here and typed in satang.
// ONLY `salary-people.service.ts` imports this file; no component does. The wiring TASK (TASK-869) swaps the service bodies and deletes it.
// FIXED example numbers; a total shown on a screen is only the SUM of the rows shown. Names are invented (CONVENTIONS §2.8).
import type { DailyDay, PaymentSettings, PersonProfile, PersonRow } from "@/types/app/salary-people";

const baht = (n: number) => n * 100;

export const PEOPLE_FIXTURE: PersonRow[] = [
  { name: "Pete", types: ["Full-time"], vehicle: "car", baseSatang: baht(20800), merit: "Every 3 months" },
  { name: "May", types: ["Full-time"], vehicle: "motorbike", baseSatang: baht(21000), merit: "Every 3 months" },
  { name: "Ton", types: ["Part-time · Sat–Sun", "Freelance · Mon–Fri"], vehicle: "car", baseSatang: baht(8000), merit: "Every 3 months" },
  { name: "Ploy", types: ["STAFF"], vehicle: "none", baseSatang: baht(15000), merit: "Monthly" },
  { name: "Nam", types: ["STAFF"], vehicle: "motorbike", baseSatang: baht(17200), merit: "Monthly" },
  { name: "Beam", types: ["STAFF"], vehicle: "none", baseSatang: baht(16000), merit: "No" },
];

export const PROFILES_FIXTURE: Record<string, Omit<PersonProfile, "name">> = {
  Pete: { type: "Full-time", baseSatang: baht(20800), rates: null, merit: "Yes · every 3 months (Nov 2026)", bonus: "Bonus 50 · Bonus 100", commission: "All — shared among employees", vehicle: "car" },
  May: { type: "Full-time", baseSatang: baht(21000), rates: null, merit: "Yes · every 3 months (Nov 2026)", bonus: "Bonus 50 · Bonus 100", commission: "All — shared among employees", vehicle: "motorbike" },
  Ton: {
    type: "Part-time (Sat–Sun) + Freelance (Mon–Fri)",
    baseSatang: baht(8000),
    rates: ["Private 300", "Duo 350", "Group 250", "ECA 400", "Camp 300"],
    merit: "Yes · every 3 months (Nov 2026)",
    bonus: "Bonus 50 · Bonus 100 (Part-time days)",
    commission: "All",
    vehicle: "car",
    roleByDay: ["Freelance", "Freelance", "Freelance", "Freelance", "Freelance", "Part-time", "Part-time"],
  },
  Ploy: { type: "STAFF", baseSatang: baht(15000), rates: null, merit: "Yes · monthly", bonus: "—", commission: "Only Skate bag", vehicle: "none" },
  Nam: { type: "STAFF", baseSatang: baht(17200), rates: null, merit: "Yes · monthly", bonus: "—", commission: "Only Skate bag", vehicle: "motorbike" },
  Beam: { type: "STAFF", baseSatang: baht(16000), rates: null, merit: "No", bonus: "—", commission: "Only Skate bag", vehicle: "none" },
};

export const SETTINGS_FIXTURE: PaymentSettings = {
  cards: [
    {
      title: "Extra Hour",
      rows: [
        ["Rate", "350 ฿ per hour"],
        ["Weekday", "> 4th HR"],
        ["Weekend", "> 5th HR"],
        ["Apply to", "Full-time · Part-time"],
      ],
    },
    {
      title: "OT",
      rows: [
        ["Per hour", "Salary ÷ 26 ÷ 8 × 1.15"],
        ["Hour", "Enter manually"],
        ["Apply to", "Full-time · Part-time"],
      ],
    },
    {
      title: "Bonus 50",
      rows: [
        ["Condition", "New Course/ Voucher Package after 1st Trial"],
        ["Pay to", "1st Coach"],
        ["Apply to", "Full-time · Part-time"],
      ],
    },
    {
      title: "Bonus 100",
      rows: [
        ["Condition", "Renewal Course"],
        ["Pay to", "1st Coach"],
        ["Special Case", "1st Coach & 2nd Coach share 50% (When changing coach)"],
        ["NO", "Renewal Voucher"],
        ["Apply to", "Full-time · Part-time"],
      ],
    },
  ],
  commissionGroups: [
    { group: "Animal Helmet", rate: "40 ฿", ft: "Share Equally", pt: "Own", fl: "Own", staff: "—" },
    { group: "Miller helmet", rate: "40 ฿", ft: "Share Equally", pt: "Own", fl: "Own", staff: "—" },
    { group: "Miller pads", rate: "40 ฿", ft: "Share Equally", pt: "Own", fl: "Own", staff: "—" },
    { group: "Skate bag", rate: "100 ฿", ft: "Share Equally", pt: "Own", fl: "Own", staff: "Own" },
    { group: "F&B", rate: "No commission", ft: "—", pt: "—", fl: "—", staff: "—" },
  ],
  transport: [
    { vehicle: "car", perKmSatang: baht(6), minimumSatang: baht(60) },
    { vehicle: "motorbike", perKmSatang: baht(3), minimumSatang: baht(40) },
  ],
  schools: [
    { name: "STA", km: 12 },
    { name: "ABC", km: 8 },
    { name: "RIS", km: 15 },
    { name: "WA", km: 20 },
    { name: "KIS", km: 9 },
  ],
};

export const DAILY_FIXTURE: DailyDay[] = [
  {
    date: "2026-10-13",
    weekday: "Tue",
    rows: [
      { coach: "Pete", role: "Full-time", hours: 4, description: "—", incomeSatang: null },
      { coach: "May", role: "Full-time", hours: 3, description: "—", incomeSatang: null },
      { coach: "Ton", role: "Freelance", hours: 1, description: "Private 1 Hr × 300 ฿", incomeSatang: baht(300) },
    ],
  },
  {
    date: "2026-10-14",
    weekday: "Wed",
    rows: [
      { coach: "Pete", role: "Full-time", hours: 6, description: "Extra Hour 2 Hr × 350 ฿", incomeSatang: baht(700) },
      { coach: "May", role: "Full-time", hours: 5, description: "Extra Hour 1 Hr × 350 ฿", incomeSatang: baht(350) },
      { coach: "Ton", role: "Freelance", hours: 1, description: "Private 1 Hr × 300 ฿", incomeSatang: baht(300) },
    ],
  },
];
