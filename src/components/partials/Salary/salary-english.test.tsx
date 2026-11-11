// D-150-1 (Tanya, TEST-150 §Block B) — the Pay run + Slip screens are English (the back office is English, D2). Run: `bun test src/components/partials/Salary`.
// Each test names the code whose removal makes it fail. The server's own sentences (Thai messages from the back end) are NOT labels and are shown as they come.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { ApiClientError } from "@/lib/api/client";
import { PAGE_RULES } from "@/lib/roles/pages";
import { PeriodStatusBadge, SlipStatusBadge, errorMessage } from "./parts";
import { formatInstant, periodLabel, rangeLabel, shortDate } from "./money";
import SlipView from "./SlipView";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const THAI = /[฀-๿]/;
const DIR = "src/components/partials/Salary/";

describe("no Thai label is left on the Pay run + Slip screens", () => {
  for (const f of ["PayRun.tsx", "Slip.tsx", "SlipView.tsx", "parts.tsx", "money.ts"]) {
    test(`${f} has no Thai character (labels, placeholders, toasts, aria-labels, comments)`, () => {
      const hit = readFileSync(DIR + f, "utf8")
        .split("\n")
        .map((l, i) => [i + 1, l] as const)
        .filter(([, l]) => THAI.test(l));
      expect(hit.map(([n, l]) => `${f}:${n} ${l.trim().slice(0, 60)}`)).toEqual([]);
    });
  }

  test("the Pay run menu row (it is also the page title) is plain «Pay run», on both rows that cover it", () => {
    const rows = PAGE_RULES.filter((r) => r.href === "/salary/payrun" || r.href === "/salary");
    expect(rows.map((r) => r.label)).toEqual(["Pay run", "Pay run"]);
  });

  test("the dates no longer come from the Thai locale", () => {
    expect(readFileSync(DIR + "money.ts", "utf8")).not.toContain("th-TH");
    expect(readFileSync(DIR + "PayRun.tsx", "utf8")).not.toContain("th-TH");
  });
});

describe("the shared words (one list with My slip)", () => {
  test("slip status: Draft · Confirmed · Locked; period status: Open · Locked", () => {
    expect(ui(<SlipStatusBadge status="draft" />)).toContain("Draft");
    expect(ui(<SlipStatusBadge status="confirmed" />)).toContain("Confirmed");
    expect(ui(<SlipStatusBadge status="locked" />)).toContain("Locked");
    expect(ui(<PeriodStatusBadge status="open" />)).toContain("Open");
    expect(ui(<PeriodStatusBadge status="locked" />)).toContain("Locked");
  });

  test("the fallback error sentence is English, but a server sentence is shown as it came", () => {
    expect(errorMessage(null)).toBe("Something went wrong");
    expect(errorMessage(new ApiClientError("LOCKED", "งวดนี้ถูกล็อกแล้ว", 409))).toBe("งวดนี้ถูกล็อกแล้ว");
  });

  test("dates are English: «October 2026», «16 Oct», «31 Oct – 29 Nov 2026», and an instant with a 24-hour time", () => {
    expect(periodLabel({ year: 2026, month: 10 })).toBe("October 2026");
    expect(shortDate("2026-10-16")).toBe("16 Oct");
    expect(rangeLabel({ periodStart: "2026-10-31", periodEnd: "2026-11-29" })).toBe("31 Oct – 29 Nov 2026");
    expect(formatInstant("2026-10-31T05:00:00.000Z")).toBe("31 Oct 2026, 12:00");
  });

  test("September is «Sep», never ICU's «Sept», in every short date (the period the CEO sees most: 30 Sep – 30 Oct)", () => {
    expect(shortDate("2026-09-30")).toBe("30 Sep");
    expect(rangeLabel({ periodStart: "2026-09-30", periodEnd: "2026-10-30" })).toBe("30 Sep – 30 Oct 2026");
    expect(rangeLabel({ periodStart: "2026-08-31", periodEnd: "2026-09-29" })).toBe("31 Aug – 29 Sep 2026");
    expect(formatInstant("2026-09-30T05:00:00.000Z")).toBe("30 Sep 2026, 12:00");
    expect(periodLabel({ year: 2026, month: 9 })).toBe("September 2026"); // the long name is untouched
  });

  test("the lock line does not say «12:00» twice", () => {
    expect(readFileSync(DIR + "PayRun.tsx", "utf8")).toContain("Locks automatically on ${formatInstant(period.lockAt)} (the last day of the month)");
  });
});

describe("the slip body", () => {
  const slip = {
    base: 2_500_000,
    lines: [{ id: "l1", kind: "other" as const, kindLabel: "Other", label: "late", amount: -20_000, source: "manual" as const }],
    total: 2_480_000,
  };

  test("Base salary · the lines · Net total, and a manual line's delete button is labelled in English", () => {
    const html = ui(<SlipView baseAmount={slip.base} lines={slip.lines} total={slip.total} onRemove={() => {}} />);
    expect(html).toContain("Base salary");
    expect(html).toContain("Net total");
    expect(html).toContain('aria-label="Delete line late"');
    expect(THAI.test(html)).toBe(false);
  });

  test("an empty slip says so in English", () => {
    const html = ui(<SlipView baseAmount={slip.base} lines={[]} total={slip.base} />);
    expect(html).toContain("No additions or deductions yet");
    expect(THAI.test(html)).toBe(false);
  });
});
