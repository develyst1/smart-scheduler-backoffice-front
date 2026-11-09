import type { NotificationItem, NotifyType } from "@/types/app/notification";

// Pure rules of the Notification feed (TASK-914), so the screen only draws them.

/** How many notifications are still unread. */
export const unreadCount = (items: readonly NotificationItem[]): number => items.filter((n) => !n.read).length;

/** The badge colour of a type (final-ui `NotifyAlert` TONE). */
export const TONE: Record<NotifyType, string> = { Bonus: "green", Commission: "violet", Transportation: "blue", OT: "orange", Other: "red", "Low Stock": "orange", "Extra Hour": "blue" };
