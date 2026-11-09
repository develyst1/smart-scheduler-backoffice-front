// TASK-914 wiring — the Notification pages on the real routes (BB TASK-917): GET /v1/notifications, POST /:id/read, POST /read-all, GET /recipients, GET /coaches. No network: axios gets a recording adapter.
// Each test names the code whose removal makes it fail. Run: `bun test src/components/partials/Notification/notification-914-wire`.
import { afterEach, describe, expect, test } from "bun:test";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/client";
import {
  NOTIF_SOURCE,
  NotificationError,
  listNotificationCoaches,
  listNotificationRecipients,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notification.service";

const realAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = realAdapter;
  NOTIF_SOURCE.recipients = "fixture";
  NOTIF_SOURCE.feed = "fixture";
});
function stub(answer: (c: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  NOTIF_SOURCE.recipients = "api";
  NOTIF_SOURCE.feed = "api";
  const seen: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    seen.push(config);
    const { status, data } = answer(config);
    const response = { status, data, statusText: "", headers: {}, config };
    if (status >= 400) throw new AxiosError(`HTTP ${status}`, "ERR_BAD_REQUEST", config, null, response);
    return response;
  };
  return seen;
}
const calls = (seen: InternalAxiosRequestConfig[]) => seen.map((c) => `${(c.method ?? "get").toUpperCase()} ${c.url}`);
const fail = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);
const ID = "11111111-1111-4111-8111-111111111111";
const FEED = [
  { id: ID, type: "Low Stock", text: "Miller helmet — M: 4 left (limit 5)", date: "2026-11-09", read: false },
  { id: "22222222-2222-4222-8222-222222222222", type: "Bonus", text: "For 50 : x", date: "2026-11-08", read: true },
];
const envelope = (code: string) => ({ error: { code, message: "x", details: {} } });

describe("the feed — GET /v1/notifications", () => {
  test("CEO and Admin read their own feed as the route sends it (id · type · text · date · read); a Coach gets [] and NO request", async () => {
    const seen = stub(() => ({ status: 200, data: FEED }));
    expect(await listNotifications("ceo")).toEqual(FEED);
    expect(await listNotifications("admin")).toEqual(FEED);
    expect(calls(seen)).toEqual(["GET /v1/notifications", "GET /v1/notifications"]);
    seen.length = 0;
    expect(await listNotifications("coach")).toEqual([]);
    expect(seen).toEqual([]);
  });
  test("a body that is not an array is an empty feed, not a crash", async () => {
    stub(() => ({ status: 200, data: { oops: true } }));
    expect(await listNotifications("ceo")).toEqual([]);
  });
});

describe("mark read", () => {
  test("one: POST /v1/notifications/:id/read (204); all: POST /v1/notifications/read-all", async () => {
    const seen = stub((c) => ({ status: c.url?.endsWith("/read-all") ? 200 : 204, data: c.url?.endsWith("/read-all") ? { marked: 2 } : "" }));
    await markNotificationRead("ceo", ID);
    await markAllNotificationsRead("admin");
    expect(calls(seen)).toEqual([`POST /v1/notifications/${ID}/read`, "POST /v1/notifications/read-all"]);
  });
  test("an unknown id — or someone else's — is a 404 → NOT_FOUND; a Coach is FORBIDDEN and sends nothing; a body-less 502 is not turned into either", async () => {
    stub(() => ({ status: 404, data: envelope("NOT_FOUND") }));
    const missing = await fail(markNotificationRead("ceo", ID));
    expect(missing instanceof NotificationError && missing.code).toBe("NOT_FOUND");
    const seen = stub(() => ({ status: 204, data: "" }));
    for (const f of [() => markNotificationRead("coach", ID), () => markAllNotificationsRead("coach")]) {
      const e = await fail(f());
      expect(e instanceof NotificationError && e.body).toEqual({ error: { code: "FORBIDDEN", message: "Not allowed", details: {} } });
    }
    expect(seen).toEqual([]);
    stub(() => ({ status: 502, data: "Bad gateway" }));
    const bad = await fail(markAllNotificationsRead("ceo"));
    expect(bad instanceof NotificationError).toBe(false);
    expect(bad).not.toBeNull();
  });
});

describe("Notification Setting — read-only lists, CEO only", () => {
  const RECIPIENTS = [{ who: "CEO", role: "CEO", gets: ["Bonus", "Low Stock"] }];
  const COACHES = [{ who: "Pete", type: "Full-time" }];
  test("GET /v1/notifications/recipients and /coaches for the CEO; an Admin and a Coach get [] and NO request", async () => {
    const seen = stub((c) => ({ status: 200, data: c.url?.endsWith("/coaches") ? COACHES : RECIPIENTS }));
    expect(await listNotificationRecipients("ceo")).toEqual(RECIPIENTS);
    expect(await listNotificationCoaches("ceo")).toEqual(COACHES);
    expect(calls(seen)).toEqual(["GET /v1/notifications/recipients", "GET /v1/notifications/coaches"]);
    seen.length = 0;
    for (const role of ["admin", "coach"] as const) {
      expect(await listNotificationRecipients(role)).toEqual([]);
      expect(await listNotificationCoaches(role)).toEqual([]);
    }
    expect(seen).toEqual([]);
  });
  test("there is still NO write for subscriptions in the service (ruling C-h: no opt-out)", async () => {
    const mod = await import("@/services/notification.service");
    for (const gone of ["setNotificationSubs", "getNotificationSubs", "seedSubs", "listNotifyPeople"]) expect(gone in mod).toBe(false);
  });
});
