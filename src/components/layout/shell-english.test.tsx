// D-150-1 (second pass, Porter's approved words): the shell (the NoAccess card, header, sidebar footer), every menu/guard label, and the four menu pages' own titles are English. Run: `bun test src/components/layout`.
// Each test names the code whose removal makes it fail. Server sentences, names and the Wave-1 pages' other content are out of this pass.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PAGE_RULES } from "@/lib/roles/pages";

const THAI = /[฀-๿]/;
const thaiLines = (file: string) =>
  readFileSync(file, "utf8")
    .split("\n")
    .map((l, i) => [i + 1, l] as const)
    .filter(([, l]) => THAI.test(l))
    .map(([n, l]) => `${file.split("/").slice(-2).join("/")}:${n} ${l.trim().slice(0, 60)}`);

describe("the shell has no Thai (labels, aria-labels, tooltips, comments)", () => {
  for (const f of [
    "src/components/layout/AdminLayout/AdminLayout.tsx",
    "src/components/layout/AdminLayout/Header/Header.tsx",
    "src/components/layout/AdminLayout/Sidebar/Sidebar.tsx",
    "src/lib/roles/pages.ts",
    "src/app/login/page.tsx",
  ]) {
    test(`${f.split("/").slice(-1)[0]} is Thai-free`, () => {
      expect(thaiLines(f)).toEqual([]);
    });
  }

  test("the NoAccess card: «This role can't see this page» · «Back to my home» · a «this page» fallback for an unlisted path", () => {
    const src = readFileSync("src/components/layout/AdminLayout/AdminLayout.tsx", "utf8");
    expect(src).toContain("This role can't see this page");
    expect(src).toContain("Back to my home");
    expect(src).toContain('?? "this page"');
  });

  test("the sidebar footer (desktop and mobile drawer) reads «v0.1 · Back office team»", () => {
    const src = readFileSync("src/components/layout/AdminLayout/Sidebar/Sidebar.tsx", "utf8");
    expect(src.split("v0.1 · Back office team").length - 1).toBe(2);
  });

  test("the header: Sign out (tooltip + aria), Open / Expand / Collapse menu, Role", () => {
    const src = readFileSync("src/components/layout/AdminLayout/Header/Header.tsx", "utf8");
    for (const w of ['label="Sign out"', 'aria-label="Sign out"', 'aria-label="Open menu"', '"Expand menu"', '"Collapse menu"', 'aria-label="Role"']) expect(src).toContain(w);
  });
});

describe("the sign-in page (Porter ruled it English; the helper keeps its meaning)", () => {
  const src = readFileSync("src/app/login/page.tsx", "utf8").replace(/\r\n/g, "\n"); // the file may be CRLF

  test("Sign in (title and button) · Username · Password · the helper in Porter's exact words", () => {
    expect(src.split("Sign in\n").length - 1).toBe(2); // the title and the button
    expect(src).toContain('label="Username"');
    expect(src).toContain('label="Password"');
    expect(src).toContain("Use the same username and password as the front office.");
  });

  test("the two messages: «Enter a username and password» (empty form) and «Sign in failed» (a failure with no server sentence)", () => {
    expect(src).toContain('setError("Enter a username and password")');
    expect(src).toContain('err.message : "Sign in failed"');
  });

  test("a server sentence is still shown as it comes (the back end's «Wrong username or password.»)", () => {
    expect(src).toContain("err instanceof ApiClientError ? err.message");
  });
});

describe("every menu / guard label is English (Porter's words)", () => {
  test("no PAGE_RULES label has a Thai character", () => {
    expect(PAGE_RULES.filter((r) => THAI.test(r.label)).map((r) => `${r.href} ${r.label}`)).toEqual([]);
  });

  test("the four Wave-1 menu rows", () => {
    const label = (href: string) => PAGE_RULES.find((r) => r.href === href)?.label;
    expect(label("/dashboard")).toBe("P&L");
    expect(label("/revenue")).toBe("Revenue by activity");
    expect(label("/items")).toBe("Items");
    expect(label("/tags")).toBe("Tags");
  });

  test("the legacy guarded-only rows (not in any menu) are English too", () => {
    const label = (href: string) => PAGE_RULES.find((r) => r.href === href)?.label;
    expect(label("/my-slip")).toBe("My slip");
    expect(label("/payroll")).toBe("Payroll");
    expect(label("/ftpt-salary")).toBe("FT/PT salary");
    expect(label("/freelance-budgets")).toBe("Freelance budget");
  });
});

describe("each of the four pages' own title matches its menu word", () => {
  const h1 = (file: string) => (readFileSync(file, "utf8").match(/<h1[^>]*>([^<]*)<\/h1>/) ?? [])[1];
  test("Dashboard «P&L» · Revenue «Revenue by activity» · Items «Items» (both Items pages) · Tags «Tags»", () => {
    expect(h1("src/components/partials/Dashboard/DashboardContent.tsx")).toBe("P&L");
    expect(h1("src/components/partials/Revenue/RevenueContent.tsx")).toBe("Revenue by activity");
    expect(h1("src/components/partials/Items/ItemsContent.tsx")).toBe("Items");
    expect(h1("src/components/partials/BoItems/BoItemsContent.tsx")).toBe("Items");
    expect(h1("src/components/partials/BoTags/BoTagsContent.tsx")).toBe("Tags");
  });
});
