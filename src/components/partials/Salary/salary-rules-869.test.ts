// TASK-869 follow-up (gap 4, Silver's condition) — the Payment Setting rule cards are a READ-ONLY fixture (no route yet), so their numbers must equal the real pay constants.
// Run: `bun test src/components/partials/Salary/salary-rules-869.test.ts`. The real constants live in the sibling repo `smart-scheduler-backoffice-back`
// (`src/lib/pay-rules.ts`, `src/lib/transport-pricing.ts`, `src/services/bonus-lines.service.ts`); the test reads their SOURCE (a front test cannot import the back's code).
// If the sibling folder is not next to this repo (another machine), the cross-repo half is reported as skipped on the console — it is NOT a pass; the half that needs no sibling still runs.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { SETTINGS_FIXTURE } from "@/services/__fixtures__/salary-people";

const BB = "../smart-scheduler-backoffice-back/src";
const read = (f: string): string | null => (existsSync(`${BB}/${f}`) ? readFileSync(`${BB}/${f}`, "utf8") : null);
const card = (title: string) => SETTINGS_FIXTURE.cards.find((c) => c.title === title)?.rows ?? [];
const row = (title: string, key: string) => card(title).find(([k]) => k === key)?.[1] ?? "";
/** `export const NAME = 35_000;` / `... = { car: 6, motorbike: 3 };` → the text after `=` up to `;` */
const constant = (src: string, name: string): string => {
  const m = new RegExp(`export const ${name}\\b[^=]*=\\s*([^;]+);`).exec(src);
  if (!m) throw new Error(`constant ${name} not found in the back's source — it moved or was renamed; update this test`);
  return m[1].trim();
};
const num = (s: string) => Number(s.replace(/_/g, ""));

describe("Payment Setting rule cards = the real constants", () => {
  test("Extra Hour: «350 ฿ per hour», weekday after the 4th hour (240 min), weekend after the 5th (300 min)", () => {
    const src = read("lib/pay-rules.ts");
    if (!src) return void console.warn("salary-rules-869: sibling backoffice-back not found — cross-repo check SKIPPED");
    expect(row("Extra Hour", "Rate")).toBe(`${num(constant(src, "EXTRA_HOUR_RATE_SATANG")) / 100} ฿ per hour`);
    expect(row("Extra Hour", "Weekday")).toBe(`> ${num(constant(src, "EXTRA_THRESHOLD_MIN_WEEKDAY")) / 60}th HR`);
    expect(row("Extra Hour", "Weekend")).toBe(`> ${num(constant(src, "EXTRA_THRESHOLD_MIN_WEEKEND")) / 60}th HR`);
  });

  test("OT: «Salary ÷ 26 ÷ 8 × 1.15» is the formula the engine documents and computes (÷ 26 ÷ 8 × 1.15, as 115 over 26 × 8 × 100 × 60)", () => {
    const src = read("lib/pay-rules.ts");
    if (!src) return void console.warn("salary-rules-869: sibling backoffice-back not found — cross-repo check SKIPPED");
    expect(row("OT", "Per hour")).toBe("Salary ÷ 26 ÷ 8 × 1.15");
    expect(src).toContain("÷ 26 ÷ 8 × 1.15");
    expect(src).toMatch(/baseSatang\)\s*\*\s*115n/); // the numerator's 115 (= 1.15 × 100) …
    expect(src).toMatch(/26n\s*\*\s*8n\s*\*\s*100n\s*\*\s*60n/); // … over 26 × 8 × 100 × 60
  });

  test("Bonus 50 / Bonus 100: the card titles name the amounts the bonus lines pay (5,000 / 10,000 satang)", () => {
    const src = read("services/bonus-lines.service.ts");
    if (!src) return void console.warn("salary-rules-869: sibling backoffice-back not found — cross-repo check SKIPPED");
    expect(num(constant(src, "BONUS_50_SATANG")) / 100).toBe(Number(/Bonus (\d+)/.exec(SETTINGS_FIXTURE.cards[2].title)?.[1]));
    expect(num(constant(src, "BONUS_100_SATANG")) / 100).toBe(Number(/Bonus (\d+)/.exec(SETTINGS_FIXTURE.cards[3].title)?.[1]));
  });

  test("Transportation: Car 6 ฿ / km, minimum 60 ฿; Motorbike («Motorcycle») 3 ฿ / km, minimum 40 ฿", () => {
    const src = read("lib/transport-pricing.ts");
    if (!src) return void console.warn("salary-rules-869: sibling backoffice-back not found — cross-repo check SKIPPED");
    const perKm = constant(src, "RATE_BAHT_PER_KM");
    const min = constant(src, "MIN_SATANG");
    const pick = (obj: string, k: string) => num(new RegExp(`${k}:\\s*([\\d_]+)`).exec(obj)?.[1] ?? "NaN");
    for (const t of SETTINGS_FIXTURE.transport) {
      expect(t.perKmSatang).toBe(pick(perKm, t.vehicle) * 100);
      expect(t.minimumSatang).toBe(pick(min, t.vehicle));
    }
    expect(SETTINGS_FIXTURE.transport.map((t) => t.vehicle)).toEqual(["car", "motorbike"]);
  });

  test("(no sibling needed) the fixture's own numbers are the ones this file pins, so an edit to the fixture alone fails here", () => {
    expect(row("Extra Hour", "Rate")).toBe("350 ฿ per hour");
    expect(SETTINGS_FIXTURE.transport).toEqual([
      { vehicle: "car", perKmSatang: 600, minimumSatang: 6000 },
      { vehicle: "motorbike", perKmSatang: 300, minimumSatang: 4000 },
    ]);
    expect(SETTINGS_FIXTURE.cards.map((c) => c.title)).toEqual(["Extra Hour", "OT", "Bonus 50", "Bonus 100"]);
  });
});
