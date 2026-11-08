import { Badge } from "@mantine/core";
import type {
  RevenueBranch,
  RevenueLineType,
  RevenueMethod,
} from "@/types/app/revenue-ledger";

// D2: the screens are English. The API returns codes; this is the only place they become words.
export const TYPE_LABEL: Record<RevenueLineType, string> = {
  COURSE: "COURSE",
  TRIAL: "1st Trial",
  VOUCHER: "VOUCHER",
  ECA: "ECA",
  SALES: "SALES",
  FNB: "F&B",
  RENT: "RENT",
  OTHER: "OTHER",
  REFUND: "Refund",
};

export const BRANCH_LABEL: Record<RevenueBranch, string> = { BRAVO: "Bravo", OTHER: "Other" };

export const METHOD_LABEL: Record<RevenueMethod, string> = {
  TRANSFER: "Transfer",
  CASH: "Cash",
  CARD: "Credit card",
};

const TYPE_COLOR: Record<RevenueLineType, string> = {
  COURSE: "blue",
  TRIAL: "cyan",
  VOUCHER: "violet",
  ECA: "teal",
  SALES: "orange",
  FNB: "yellow",
  RENT: "grape",
  OTHER: "gray",
  REFUND: "red",
};

export function TypeBadge({ type }: { type: RevenueLineType }) {
  return (
    <Badge variant="light" color={TYPE_COLOR[type]} radius="sm" w="max-content" maw="none">
      {TYPE_LABEL[type].toUpperCase()}
    </Badge>
  );
}

/** Satang -> baht with thousands separators, `3,705 ฿`; a negative (refund) gets a real minus sign.
 *  Whole baht print without decimals; a non-zero satang part is kept, never rounded away. */
export function money(minor: number): string {
  const abs = Math.abs(minor);
  const whole = abs % 100 === 0;
  const text = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${minor < 0 ? "−" : ""}${text} ฿`;
}

/** `2026-10-16` -> `16/10/26` (the final UI's date format). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
}

/** Today's calendar date in Asia/Bangkok, `YYYY-MM-DD` (SPEC-098: the count date is a Bangkok date). */
export function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}
