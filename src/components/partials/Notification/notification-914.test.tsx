// TASK-914 — Notification Setting (a read-only recipient LIST, ruling C-h: no opt-out) + the Notification Alert feed (REQ-120 R0.4) on fixtures. Run: `bun test src/components/partials/Notification`.
// FE only: the per-type EVENT GENERATION and the real store are backend follow-ons. Each test names the code whose removal makes it fail.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { canOpen, menuFor } from "@/lib/roles/pages";
import * as service from "@/services/notification.service";
import {
  NOTIF_SOURCE,
  NotificationError,
  listNotificationCoaches,
  listNotificationRecipients,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resetNotificationFixture,
} from "@/services/notification.service";
import { unreadCount } from "./notification-logic";
import { NotificationSettingsBody } from "./NotificationSettings";
import { NotificationFeedBody } from "./NotificationFeed";
import { NOTIFY_TYPES } from "@/types/app/notification";

afterEach(() => resetNotificationFixture());

const ui = (el: React.ReactElement) => renderToStaticMarkup(<MantineProvider>{el}</MantineProvider>);

describe("the six types and who is told what (R0.4, ruling C-h)", () => {
  test("the union is the SEVEN types of the BB seam (TASK-917), in its CHECK order: Bonus · Commission · Transportation · OT · Other · Low Stock · Extra Hour", () => {
    expect([...NOTIFY_TYPES]).toEqual(["Bonus", "Commission", "Transportation", "OT", "Other", "Low Stock", "Extra Hour"]);
    expect(NOTIFY_TYPES).toHaveLength(7);
  });
  test("the list: the CEO gets ALL seven; Beam (the customer's London) gets Low Stock; Ploy Bonus — role-derived, as the final UI shows", async () => {
    const r = await listNotificationRecipients("ceo");
    expect(r.find((x) => x.who === "CEO")).toEqual({ who: "CEO", role: "CEO", gets: [...NOTIFY_TYPES] });
    expect(r.find((x) => x.who === "Beam")).toMatchObject({ role: "Admin", gets: ["Low Stock"] });
    expect(r.find((x) => x.who === "Ploy")).toMatchObject({ role: "Admin", gets: ["Bonus"] });
  });
  test("the page is the CEO's: an Admin or a Coach gets nothing (hidden, never masked)", async () => {
    for (const role of ["admin", "coach"] as const) {
      expect(await listNotificationRecipients(role)).toEqual([]);
      expect(await listNotificationCoaches(role)).toEqual([]);
    }
    expect((await listNotificationCoaches("ceo")).map((c) => c.who)).toEqual(["Pete", "May", "Ton"]);
  });
  test("NO opt-out: the service has no write for subscriptions at all (ruling C-h) — only the feed's read marks", () => {
    for (const gone of ["setNotificationSubs", "getNotificationSubs", "seedSubs", "listNotifyPeople"]) expect(gone in service).toBe(false);
  });
});

describe("the web feed (listNotifications / mark read)", () => {
  test("the CEO sees seven (one per type), an Admin three, a Coach none", async () => {
    const ceo = await listNotifications("ceo");
    expect(ceo.map((n) => n.type).sort()).toEqual([...NOTIFY_TYPES].sort());
    expect((await listNotifications("admin")).length).toBe(3);
    expect(await listNotifications("coach")).toEqual([]);
  });
  test("R0: an Admin's items carry NO money — no «฿», no amount of pay", async () => {
    for (const n of await listNotifications("admin")) expect(n.text).not.toMatch(/฿|\d+\s*Hr ×|THB/);
  });
  test("mark one read, mark all read; an unknown id is NOT_FOUND; a Coach is FORBIDDEN (standard envelope)", async () => {
    expect(unreadCount(await listNotifications("ceo"))).toBe(7);
    await markNotificationRead("ceo", "c1");
    expect(unreadCount(await listNotifications("ceo"))).toBe(6);
    await markAllNotificationsRead("ceo");
    expect(unreadCount(await listNotifications("ceo"))).toBe(0);
    expect(unreadCount(await listNotifications("admin"))).toBe(3); // the Admin's own feed is separate
    const missing = await markNotificationRead("ceo", "nope").then(() => null, (x: unknown) => x);
    expect(missing instanceof NotificationError && missing.code).toBe("NOT_FOUND");
    const forbidden = await markAllNotificationsRead("coach").then(() => null, (x: unknown) => x);
    expect(forbidden instanceof NotificationError && forbidden.body).toEqual({ error: { code: "FORBIDDEN", message: "Not allowed", details: {} } });
  });
  test("the data is on the fixture switch, and no component imports the fixture", () => {
    expect(NOTIF_SOURCE).toEqual({ recipients: "fixture", feed: "fixture" });
    for (const f of readdirSync("src/components/partials/Notification").filter((x) => /\.(tsx?|ts)$/.test(x) && !/\.test\.tsx?$/.test(x))) {
      expect(readFileSync(`src/components/partials/Notification/${f}`, "utf8")).not.toContain("__fixtures__");
    }
  });
});

describe("the screens, rendered", () => {
  test("Setting: «CEO and Staff» with Who · Role · Gets, «In the web», a badge per type each person gets, the coaches card with «MYSELF - ALWAYS» — and NO switch, NO Save", async () => {
    const html = ui(<NotificationSettingsBody recipients={await listNotificationRecipients("ceo")} coaches={await listNotificationCoaches("ceo")} />);
    for (const w of ["Notification Setting", "CEO and Staff", "In the web", "Who", "Role", "Gets", "Coach (Full-time / Part-time)", "MYSELF - ALWAYS", ...NOTIFY_TYPES]) expect(html).toContain(w);
    for (const who of ["CEO", "Beam", "Ploy"]) expect(html).toContain(`data-recipient="${who}"`);
    for (const who of ["Pete", "May", "Ton"]) expect(html).toContain(`data-coach="${who}"`);
    expect(html).not.toMatch(/role="switch"|type="checkbox"|data-save|>Save</);
    expect(html).not.toMatch(/฿|salary|Salary/);
  });
  test("Feed: «N new», «Mark all as read», a row per item with its type, text and a dd/mm/yy date (no time); read rows are marked", async () => {
    const items = await listNotifications("ceo");
    items[0].read = true;
    const html = ui(<NotificationFeedBody items={items} onRead={() => {}} onReadAll={() => {}} />);
    for (const w of ["Notification Alert", "6 new", "Mark all as read", "Mark as read", "21/10/26", "Bonus", "Low Stock"]) expect(html).toContain(w);
    expect(html).toContain('data-read="true"');
    expect(html).not.toMatch(/\d{2}:\d{2}/); // no time of day
  });
  test("an empty feed says so", () => {
    expect(ui(<NotificationFeedBody items={[]} onRead={() => {}} onReadAll={() => {}} />)).toContain("No notifications");
  });
});

describe("the page rules (PAGE_RULES, tagged TASK-914)", () => {
  const labels = (role: "ceo" | "admin" | "coach") => menuFor(role).flatMap((g) => g.items.map((i) => `${g.group}:${i.label}`));
  test("Notification Setting: CEO only; Notification Alert: CEO + Admin; a Coach gets neither", () => {
    expect(labels("ceo")).toContain("NOTIFICATION:Notification Setting");
    expect(labels("ceo")).toContain("NOTIFICATION:Notification Alert");
    expect(labels("admin")).toContain("NOTIFICATION:Notification Alert");
    expect(labels("admin")).not.toContain("NOTIFICATION:Notification Setting");
    expect(labels("coach").some((l) => l.startsWith("NOTIFICATION:"))).toBe(false);
    expect(canOpen("ceo", "/notify/settings")).toBe(true);
    expect(canOpen("admin", "/notify/settings")).toBe(false);
    expect(canOpen("admin", "/notify/inbox")).toBe(true);
    expect(canOpen("coach", "/notify/inbox")).toBe(false);
  });
});
