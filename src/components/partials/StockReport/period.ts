import dayjs from "dayjs";

// TASK-906 — the period filter's logic, kept pure. Both ends are inclusive (Q2 [team-proposed], as `GET /revenue/lines`); a custom range is at most 366 days.

export type PeriodPreset = "day" | "month" | "custom";
export const MAX_PERIOD_DAYS = 366;
const FMT = "YYYY-MM-DD";

export interface Period {
  from: string;
  to: string;
}

/** The range a preset gives from a reference day. Custom keeps whatever range it already had. */
export function periodOf(preset: PeriodPreset, day: string, current?: Period): Period {
  if (preset === "day") return { from: day, to: day };
  if (preset === "month") return { from: dayjs(day).startOf("month").format(FMT), to: dayjs(day).endOf("month").format(FMT) };
  return current ?? { from: day, to: day };
}

/** `null` when the range may be asked for; otherwise the sentence to show (never sent to the reader). */
export function periodProblem(p: Period): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.from) || !/^\d{4}-\d{2}-\d{2}$/.test(p.to)) return "Pick both dates.";
  if (p.from > p.to) return "From must not be after To.";
  if (dayjs(p.to).diff(dayjs(p.from), "day") + 1 > MAX_PERIOD_DAYS) return `A period is at most ${MAX_PERIOD_DAYS} days.`;
  return null;
}
