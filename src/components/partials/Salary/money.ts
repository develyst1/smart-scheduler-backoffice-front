import type { Money, PayPeriod } from "@/types/app/salary";

// Money is summed and compared in whole satang (integers), never as float baht; baht text appears only at display (SPEC-100 §4).

/** SPEC-100 §5: money over HTTP is integer satang already. Anything else → null (the caller shows "—", never a made-up 0). */
export function toSatang(m: Money | null | undefined): number | null {
  return typeof m === "number" && Number.isSafeInteger(m) ? m : null;
}

/** What the amount field holds ("1500.50", "-500", 1500.5 baht) → whole satang; unreadable → null. Text is parsed, never multiplied as a float. */
export function bahtInputToSatang(v: string | number): number | null {
  const hit = /^(-?)(\d+)(?:\.(\d{0,2})\d*)?$/.exec(String(v).trim());
  if (!hit) return null;
  const n = Number(hit[2]) * 100 + Number((hit[3] ?? "").padEnd(2, "0"));
  return hit[1] ? -n : n;
}

/** 1234550 → "12,345.50" (sign kept as "-"). */
export function formatBaht(satang: number | null): string {
  if (satang === null) return "—";
  const abs = Math.abs(satang);
  const body = `${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
  return satang < 0 ? `-${body}` : body;
}

/** Signed display for an Other± line: always a sign, so a deduction cannot be read as an addition. */
export function formatSigned(satang: number | null): string {
  if (satang === null) return "—";
  return satang < 0 ? `−${formatBaht(-satang)}` : `+${formatBaht(satang)}`;
}

const TZ = "Asia/Bangkok";
const LOCALE = "th-TH-u-ca-gregory"; // Thai words, Gregorian year (the team writes 2026, not 2569)

export function periodLabel(p: Pick<PayPeriod, "year" | "month">): string {
  return new Date(Date.UTC(p.year, p.month - 1, 15)).toLocaleDateString(LOCALE, { month: "long", year: "numeric", timeZone: TZ });
}

/** Final-UI date format dd/mm/yy in Bangkok time: an instant or "YYYY-MM-DD" → "31/10/26". */
export function fmtDate(v: string | Date): string {
  const d = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? "UTC" : TZ;
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: tz }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}

/**
 * The pay range of a month, as final-ui's `periodOf`: from the LAST day of the previous month to the day before the LAST day of this month
 * (the rule Khwan agreed; the back's `payPeriodRange` is the same). The admin cannot read periods, so the Entries toast draws it from this.
 */
export function payRangeOf(year: number, month: number): string {
  const lastOfPrev = new Date(Date.UTC(year, month - 1, 0));
  const dayBeforeLast = new Date(Date.UTC(year, month, 0) - 86_400_000); // last day of `month`, minus one day
  return `${fmtDate(lastOfPrev.toISOString().slice(0, 10))}–${fmtDate(dayBeforeLast.toISOString().slice(0, 10))}`;
}

/** "Oct 2026" — the ‹ month year › picker label (final-ui's `MMM YYYY`). */
export function monthYearLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** The current month in Bangkok. */
export function currentYearMonth(now: Date = new Date()): { year: number; month: number } {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: TZ }).format(now).split("-");
  return { year: Number(y), month: Number(m) };
}

/** "2026-10-16" → "16 ต.ค." ; unreadable → the input as given. */
export function shortDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "31 ต.ค. – 29 พ.ย. 2026" from the period's inclusive YYYY-MM-DD range; "" when the BE sent none. */
export function rangeLabel(p: Pick<PayPeriod, "periodStart" | "periodEnd">): string {
  const day = (s: string, withYear: boolean) => {
    const d = new Date(`${s}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(LOCALE, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
  };
  const a = p.periodStart ? day(p.periodStart, false) : null;
  const b = p.periodEnd ? day(p.periodEnd, true) : null;
  return a && b ? `${a} – ${b}` : "";
}

export function formatInstant(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
}

export function csvName(p: Pick<PayPeriod, "year" | "month">): string {
  return `payrun-${p.year}-${String(p.month).padStart(2, "0")}.csv`;
}
