// TASK-914 — the data seam of the Notification pages (R0.4). FIXTURE until a backend store lands (`NOTIF_SOURCE`): the per-type EVENT GENERATION is a cross-team backend follow-on, NOT here.
// Ruling C-h (REQ-122): no opt-out — who receives what is DERIVED from role, so «Notification Setting» is a read-only list (no write seam exists, on purpose).
import { COACHES_FIXTURE, FEED_ADMIN_FIXTURE, FEED_CEO_FIXTURE, RECIPIENTS_FIXTURE } from "@/services/__fixtures__/notification";
import type { Role } from "@/types/app/roles";
import type { NotificationItem, NotifyCoach, NotifyRecipient } from "@/types/app/notification";

export const NOTIF_SOURCE: { recipients: "fixture"; feed: "fixture" } = { recipients: "fixture", feed: "fixture" };

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

let feeds: { ceo: NotificationItem[]; admin: NotificationItem[] } | null = null;
const feedStore = () => (feeds ??= { ceo: structuredClone(FEED_CEO_FIXTURE), admin: structuredClone(FEED_ADMIN_FIXTURE) });
/** Put the fixture back as shipped (tests; the wiring task deletes the store with the fixture). */
export const resetNotificationFixture = (): void => {
  feeds = null;
};

/** «CEO and Staff»: who is told about what, in the web. CEO ONLY (Notification Setting is the CEO's page); anyone else gets nothing — hidden, never masked. */
export async function listNotificationRecipients(role: Role): Promise<NotifyRecipient[]> {
  return role === "ceo" ? structuredClone(RECIPIENTS_FIXTURE) : [];
}

/** «Coach (Full-time / Part-time)»: coaches are always told of their own items. CEO only. */
export async function listNotificationCoaches(role: Role): Promise<NotifyCoach[]> {
  return role === "ceo" ? structuredClone(COACHES_FIXTURE) : [];
}

/** The web feed of the signed-in role: the CEO's six, an Admin's three (no money). A Coach gets nothing. */
export async function listNotifications(role: Role): Promise<NotificationItem[]> {
  if (role === "coach") return [];
  return structuredClone(role === "ceo" ? feedStore().ceo : feedStore().admin);
}

export async function markNotificationRead(role: Role, id: string): Promise<void> {
  if (role === "coach") throw new NotificationError("FORBIDDEN", "Not allowed");
  const item = (role === "ceo" ? feedStore().ceo : feedStore().admin).find((n) => n.id === id);
  if (!item) throw new NotificationError("NOT_FOUND", "Notification not found");
  item.read = true;
}

export async function markAllNotificationsRead(role: Role): Promise<void> {
  if (role === "coach") throw new NotificationError("FORBIDDEN", "Not allowed");
  for (const n of role === "ceo" ? feedStore().ceo : feedStore().admin) n.read = true;
}
