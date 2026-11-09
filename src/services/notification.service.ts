// TASK-914 — the data seam of the Notification pages (R0.4). Wired to `/v1/notifications*` (BB TASK-917; `NOTIF_SOURCE`). A fixture twin runs when a switch is "fixture" (tests, dev).
// Ruling C-h (REQ-122): no opt-out — who receives what is DERIVED from role, so «Notification Setting» is a read-only list (no write seam exists, on purpose).
// The per-type EVENT GENERATION lives on the back end (the producers write through `createNotification`, not through HTTP).
import { api, ApiClientError } from "@/lib/api/client";
import { COACHES_FIXTURE, FEED_ADMIN_FIXTURE, FEED_CEO_FIXTURE, RECIPIENTS_FIXTURE } from "@/services/__fixtures__/notification";
import type { Role } from "@/types/app/roles";
import type { NotificationItem, NotifyCoach, NotifyRecipient } from "@/types/app/notification";

/** Flipped per screen: `recipients` = Notification Setting (`/recipients`, `/coaches`), `feed` = Notification Alert (`/`, `/:id/read`, `/read-all`). */
export const NOTIF_SOURCE: { recipients: "fixture" | "api"; feed: "fixture" | "api" } = { recipients: "api", feed: "api" };

const BASE = "/v1/notifications";

/** Why a notification call was refused; `.body` is the app's standard error ENVELOPE. */
export class NotificationError extends Error {
  constructor(
    public code: "FORBIDDEN" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "NotificationError";
  }
  get body(): { error: { code: string; message: string; details: Record<string, never> } } {
    return { error: { code: this.code, message: this.message, details: {} } };
  }
}

/** A real route's refusal as the screens' own error (404 ⇒ not found — also for someone else's item, the route never reveals which; 403 ⇒ forbidden); anything else passes through untouched. */
function asNotificationError(e: unknown): never {
  if (e instanceof ApiClientError) {
    if (e.status === 404) throw new NotificationError("NOT_FOUND", "Notification not found");
    if (e.status === 403) throw new NotificationError("FORBIDDEN", "Not allowed");
  }
  throw e;
}

let feeds: { ceo: NotificationItem[]; admin: NotificationItem[] } | null = null;
const feedStore = () => (feeds ??= { ceo: structuredClone(FEED_CEO_FIXTURE), admin: structuredClone(FEED_ADMIN_FIXTURE) });
/** Put the fixture back as shipped (tests). */
export const resetNotificationFixture = (): void => {
  feeds = null;
};

/** «CEO and Staff»: who is told about what, in the web (`GET /v1/notifications/recipients`). CEO ONLY (Notification Setting is the CEO's page); anyone else gets nothing and no request is made — hidden, never masked. */
export async function listNotificationRecipients(role: Role): Promise<NotifyRecipient[]> {
  if (role !== "ceo") return [];
  if (NOTIF_SOURCE.recipients === "api") {
    const { data } = await api.get<NotifyRecipient[]>(`${BASE}/recipients`);
    return Array.isArray(data) ? data : [];
  }
  return structuredClone(RECIPIENTS_FIXTURE);
}

/** «Coach (Full-time / Part-time)»: coaches are always told of their own items (`GET /v1/notifications/coaches`). CEO only. */
export async function listNotificationCoaches(role: Role): Promise<NotifyCoach[]> {
  if (role !== "ceo") return [];
  if (NOTIF_SOURCE.recipients === "api") {
    const { data } = await api.get<NotifyCoach[]>(`${BASE}/coaches`);
    return Array.isArray(data) ? data : [];
  }
  return structuredClone(COACHES_FIXTURE);
}

/** The web feed of the signed-in person — their OWN items, newest first (`GET /v1/notifications`, no money in any text). A Coach gets nothing and no request is made. */
export async function listNotifications(role: Role): Promise<NotificationItem[]> {
  if (role === "coach") return [];
  if (NOTIF_SOURCE.feed === "api") {
    const { data } = await api.get<NotificationItem[]>(BASE);
    return Array.isArray(data) ? data : [];
  }
  return structuredClone(role === "ceo" ? feedStore().ceo : feedStore().admin);
}

/** `POST /v1/notifications/:id/read` (204). An unknown id — or someone else's — is NOT_FOUND. */
export async function markNotificationRead(role: Role, id: string): Promise<void> {
  if (role === "coach") throw new NotificationError("FORBIDDEN", "Not allowed");
  if (NOTIF_SOURCE.feed === "api") {
    try {
      await api.post(`${BASE}/${encodeURIComponent(id)}/read`);
    } catch (e) {
      return asNotificationError(e);
    }
    return;
  }
  const item = (role === "ceo" ? feedStore().ceo : feedStore().admin).find((n) => n.id === id);
  if (!item) throw new NotificationError("NOT_FOUND", "Notification not found");
  item.read = true;
}

/** `POST /v1/notifications/read-all` → `{ marked }` — the caller's own unread items. */
export async function markAllNotificationsRead(role: Role): Promise<void> {
  if (role === "coach") throw new NotificationError("FORBIDDEN", "Not allowed");
  if (NOTIF_SOURCE.feed === "api") {
    try {
      await api.post(`${BASE}/read-all`);
    } catch (e) {
      return asNotificationError(e);
    }
    return;
  }
  for (const n of role === "ceo" ? feedStore().ceo : feedStore().admin) n.read = true;
}
