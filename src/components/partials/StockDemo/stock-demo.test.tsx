// TASK-918 — Stock DEMO on the fixture seam (it behaves like TASK-915's routes). Run: `bun test src/components/partials/StockDemo`.
// Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { ApiClientError } from "@/lib/api/client";
import { canOpen, menuFor } from "@/lib/roles/pages";
import { addDemoSite, defectInDemo, deleteDemo, getDemoStock, listDemoMovements, moveDemo, orderDemoSites, resetStockDemoFixture } from "@/services/stock-demo.service";
import { DemoHistory, DemoMatrix } from "./StockDemo";
import { MSG, checkForm, demoNegativeDetails, newWriteKey, orderedSites, siteNameOk, swapIds, totalOf } from "./demo-logic";

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);
const key = () => newWriteKey();
const fail = (p: Promise<unknown>) => p.then(() => null, (e) => e as ApiClientError);

// the fixture starts clean in a fresh process; every test puts it back after itself
afterEach(() => resetStockDemoFixture());

describe("the matrix", () => {
  test("sites run left to right by sortOrder (Bravo first) and the Total column sums the row", async () => {
    const s = await getDemoStock("ceo");
    expect(orderedSites({ ...s, sites: [...s.sites].reverse() }).map((x) => x.name)).toEqual(["Bravo", "STA", "RIS", "ABC", "Abbey"]);
    const html = ui(<DemoMatrix stock={s} />);
    expect(html.indexOf('data-site="Bravo"')).toBeLessThan(html.indexOf('data-site="STA"'));
    const helmet = s.items.find((i) => i.name === "Helmet — M")!;
    expect(totalOf(helmet, s.sites)).toBe(12); // 6+3+2+0+1
    expect(html).toContain("Helmet — M");
    expect(html).toContain(">12<");
  });

  test("the history shows the date only, From → To, and the reason", async () => {
    const html = ui(<DemoHistory rows={await listDemoMovements("ceo")} />);
    expect(html).toContain("05/11/26");
    expect(html).toContain("Bravo → STA");
    expect(html).toContain("Defect Product → RIS");
    expect(html).toContain("STA class needs more");
  });
});

describe("Move A → B", () => {
  test("moves the pieces, writes one history row, and the total does not change", async () => {
    const before = await getDemoStock("ceo");
    const item = before.items[0];
    const [a, b] = before.sites;
    const out = await moveDemo({ key: key(), itemId: item.id, fromSiteId: a.id, toSiteId: b.id, qty: 1, reason: "class" }, "ceo");
    expect(out.movementsWritten).toBe(1);
    const after = (await getDemoStock("ceo")).items[0];
    expect(after.balances[a.id]).toBe(item.balances[a.id] - 1);
    expect(after.balances[b.id]).toBe(item.balances[b.id] + 1);
    expect(after.total).toBe(item.total);
    expect((await listDemoMovements("ceo"))[0]).toMatchObject({ type: "MOVE", from: "Bravo", to: "STA", qty: 1, reason: "class" });
  });

  test("a reason is required (400)", async () => {
    const s = await getDemoStock("ceo");
    const e = await fail(moveDemo({ key: key(), itemId: s.items[0].id, fromSiteId: s.sites[0].id, toSiteId: s.sites[1].id, qty: 1, reason: "  " }, "ceo"));
    expect(e?.status).toBe(400);
    expect(e?.code).toBe("VALIDATION");
  });

  test("more than A holds is refused 409 NEGATIVE_BALANCE with error.details, and nothing is written", async () => {
    const s = await getDemoStock("ceo");
    const item = s.items[0]; // 4 at Bravo
    const e = await fail(moveDemo({ key: key(), itemId: item.id, fromSiteId: s.sites[0].id, toSiteId: s.sites[1].id, qty: 9, reason: "x" }, "ceo"));
    expect(e?.status).toBe(409);
    expect(e?.code).toBe("NEGATIVE_BALANCE");
    expect(demoNegativeDetails(e)).toEqual({ itemId: item.id, siteId: s.sites[0].id, name: item.name, resultingBalance: -5 });
    expect((await getDemoStock("ceo")).items[0].balances[s.sites[0].id]).toBe(4);
    expect(await listDemoMovements("ceo")).toHaveLength(2); // only the two seeded rows
  });

  test("the same site twice is a 400", async () => {
    const s = await getDemoStock("ceo");
    const e = await fail(moveDemo({ key: key(), itemId: s.items[0].id, fromSiteId: s.sites[0].id, toSiteId: s.sites[0].id, qty: 1, reason: "x" }, "ceo"));
    expect(e?.status).toBe(400);
  });

  test("the same key twice writes once (alreadyApplied)", async () => {
    const s = await getDemoStock("ceo");
    const input = { key: key(), itemId: s.items[0].id, fromSiteId: s.sites[0].id, toSiteId: s.sites[1].id, qty: 1, reason: "x" };
    await moveDemo(input, "ceo");
    const again = await moveDemo(input, "ceo");
    expect(again.alreadyApplied).toBe(true);
    expect(again.movementsWritten).toBe(0);
    expect((await getDemoStock("ceo")).items[0].balances[s.sites[0].id]).toBe(3);
  });
});

describe("Defect Product → Demo", () => {
  test("adds pieces at the site, 'from = Defect Product', and nothing else loses any (no sale decrement)", async () => {
    const s = await getDemoStock("ceo");
    const item = s.items[3];
    await defectInDemo({ key: key(), itemId: item.id, toSiteId: s.sites[2].id, qty: 2, reason: "cracked wheel" }, "ceo");
    const after = (await getDemoStock("ceo")).items[3];
    expect(after.balances[s.sites[2].id]).toBe(item.balances[s.sites[2].id] + 2);
    expect(after.total).toBe(item.total + 2);
    for (const site of s.sites.filter((x) => x.id !== s.sites[2].id)) expect(after.balances[site.id]).toBe(item.balances[site.id]);
    expect((await listDemoMovements("ceo"))[0]).toMatchObject({ type: "DEFECT_IN", from: "Defect Product", to: "RIS", qty: 2 });
  });

  test("a reason is required (400)", async () => {
    const s = await getDemoStock("ceo");
    expect((await fail(defectInDemo({ key: key(), itemId: s.items[0].id, toSiteId: s.sites[0].id, qty: 1, reason: "" }, "ceo")))?.status).toBe(400);
  });
});

describe("Delete", () => {
  test("partial (siteId + qty) takes pieces off ONE site; the item stays; history says 'to = Deleted'", async () => {
    const s = await getDemoStock("ceo");
    const item = s.items[1]; // Helmet, 6 at Bravo
    await deleteDemo({ key: key(), itemId: item.id, siteId: s.sites[0].id, qty: 2, reason: "broken" }, "ceo");
    const after = (await getDemoStock("ceo")).items.find((i) => i.id === item.id)!;
    expect(after.balances[s.sites[0].id]).toBe(4);
    expect(after.balances[s.sites[1].id]).toBe(item.balances[s.sites[1].id]);
    expect((await listDemoMovements("ceo"))[0]).toMatchObject({ type: "WRITE_OFF", from: "Bravo", to: "Deleted", qty: 2 });
  });

  test("whole (no siteId / qty) zeroes every site and removes the item from the table; the history is kept", async () => {
    const s = await getDemoStock("ceo");
    const item = s.items[1]; // 6+3+2+0+1 across 4 sites with stock
    const out = await deleteDemo({ key: key(), itemId: item.id, reason: "retired" }, "ceo");
    expect(out.movementsWritten).toBe(4);
    expect((await getDemoStock("ceo")).items.some((i) => i.id === item.id)).toBe(false);
    const writeOffs = (await listDemoMovements("ceo")).filter((m) => m.type === "WRITE_OFF" && m.itemId === item.id);
    expect(writeOffs).toHaveLength(4);
    expect(writeOffs.every((m) => m.to === "Deleted")).toBe(true);
  });

  test("siteId without qty (or the reverse) is a 400; more than the site holds is 409", async () => {
    const s = await getDemoStock("ceo");
    const id = s.items[0].id;
    expect((await fail(deleteDemo({ key: key(), itemId: id, siteId: s.sites[0].id, reason: "x" }, "ceo")))?.status).toBe(400);
    expect((await fail(deleteDemo({ key: key(), itemId: id, qty: 1, reason: "x" }, "ceo")))?.status).toBe(400);
    expect((await fail(deleteDemo({ key: key(), itemId: id, siteId: s.sites[0].id, qty: 99, reason: "x" }, "ceo")))?.code).toBe("NEGATIVE_BALANCE");
  });
});

describe("Add Location / Location Order", () => {
  test("a new location is appended last with 0 everywhere; the same name (any case) is 409 DUPLICATE_SITE", async () => {
    const site = await addDemoSite("ISB", "ceo");
    const s = await getDemoStock("ceo");
    expect(s.sites.at(-1)?.name).toBe("ISB");
    expect(s.items.every((i) => (i.balances[site.id] ?? 0) === 0)).toBe(true);
    expect((await fail(addDemoSite("isb", "ceo")))?.code).toBe("DUPLICATE_SITE");
    expect((await fail(addDemoSite("  ", "ceo")))?.status).toBe(400);
  });

  test("reordering moves a site left; the list must be exactly the sites, no repeats", async () => {
    const s = await getDemoStock("ceo");
    const ids = s.sites.map((x) => x.id);
    await orderDemoSites(swapIds(ids, 1, -1), "ceo"); // STA before Bravo
    expect((await getDemoStock("ceo")).sites.map((x) => x.name)).toEqual(["STA", "Bravo", "RIS", "ABC", "Abbey"]);
    expect((await fail(orderDemoSites(ids.slice(1), "ceo")))?.status).toBe(400);
    expect((await fail(orderDemoSites([ids[0], ids[0], ...ids.slice(2)], "ceo")))?.status).toBe(400);
  });

  test("swapIds moves one step and stops at the edges; siteNameOk refuses empty and existing names", async () => {
    expect(swapIds(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(swapIds(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(swapIds(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
    const s = await getDemoStock("ceo");
    expect(siteNameOk("sta", s.sites)).toBe(false);
    expect(siteNameOk("", s.sites)).toBe(false);
    expect(siteNameOk("ISB", s.sites)).toBe(true);
  });
});

describe("the form checks (the final UI's own sentences)", () => {
  test("item + whole qty > 0, reason, two different sites, and enough at A", async () => {
    const s = await getDemoStock("ceo");
    const item = s.items[0]; // 4 at Bravo
    const f = { itemId: item.id, qty: 1, reason: "x", fromSiteId: s.sites[0].id, toSiteId: s.sites[1].id };
    expect(checkForm("move", f, s)).toBeNull();
    expect(checkForm("move", { ...f, itemId: null }, s)).toBe(MSG.pickAndQty);
    expect(checkForm("move", { ...f, qty: 0 }, s)).toBe(MSG.pickAndQty);
    expect(checkForm("move", { ...f, reason: " " }, s)).toBe(MSG.needReason);
    expect(checkForm("move", { ...f, toSiteId: s.sites[0].id }, s)).toBe(MSG.differentSites);
    expect(checkForm("move", { ...f, qty: 5 }, s)).toBe("Bravo มี Inline skate — size 30-33 ไม่พอ (เหลือ 4)");
    expect(checkForm("delete-partial", { ...f, qty: 5 }, s)).toContain("ไม่พอ");
    expect(checkForm("defect", { ...f, qty: 50 }, s)).toBeNull(); // a defect piece is ADDED: no balance limit
  });

  test("write keys fit the server's rule and differ per action", () => {
    const a = newWriteKey();
    expect(a).toMatch(/^[A-Za-z0-9_.-]{8,100}$/);
    expect(newWriteKey()).not.toBe(a);
  });

  test("demoNegativeDetails reads only a NEGATIVE_BALANCE with the four details", () => {
    const d = { itemId: "i", siteId: "s", name: "n", resultingBalance: -1 };
    expect(demoNegativeDetails(new ApiClientError("NEGATIVE_BALANCE", "m", 409, d))).toEqual(d);
    expect(demoNegativeDetails(new ApiClientError("DUPLICATE_SITE", "m", 409, d))).toBeNull();
    expect(demoNegativeDetails(new ApiClientError("NEGATIVE_BALANCE", "m", 409, { itemId: "i" }))).toBeNull();
  });
});

describe("who may use it", () => {
  test("CEO and Admin read and write; a Coach is refused 403 (hide, never mask)", async () => {
    expect((await getDemoStock("admin")).items.length).toBeGreaterThan(0);
    for (const role of ["coach", null] as const) {
      expect((await fail(getDemoStock(role)))?.status).toBe(403);
      expect((await fail(listDemoMovements(role)))?.status).toBe(403);
      expect((await fail(addDemoSite("X", role)))?.status).toBe(403);
    }
  });

  test("the page: in the STOCK menu for CEO and Admin, closed to a Coach", () => {
    const stock = (r: "ceo" | "admin" | "coach") => (menuFor(r).find((g) => g.group === "STOCK")?.items ?? []).map((i) => i.href);
    expect(stock("ceo")).toContain("/stock/demo");
    expect(stock("admin")).toContain("/stock/demo");
    expect(stock("coach")).not.toContain("/stock/demo");
    expect(canOpen("coach", "/stock/demo")).toBe(false);
    expect(canOpen("admin", "/stock/demo")).toBe(true);
  });
});
