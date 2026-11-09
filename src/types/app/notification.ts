// TASK-914 (REQ-120 R0.4) — in-web notifications. FE only on a fixture: the per-type EVENT GENERATION and the real notification store are cross-team backend follow-ons.
// Ruling C-h (REQ-122): notifications have NO opt-out ticks — everyone always gets all their own. «Notification Setting» is therefore a read-only list of who receives what (derived from role), not a matrix.
// R0: no pay data in a notification an Admin can see.
// Seven types, in the order of the BB seam's CHECK (TASK-917): the six of R0.4, then «Extra Hour» (the coach's own, added with the DB).
export const NOTIFY_TYPES = ["Bonus", "Commission", "Transportation", "OT", "Other", "Low Stock", "Extra Hour"] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];

/** One row of «CEO and Staff»: who is told about which types, in the web. Role-derived — nobody opts out. */
export interface NotifyRecipient {
  who: string;
  role: string;
  gets: NotifyType[];
}

/** One row of «Coach (Full-time / Part-time)»: a coach is always told of their OWN items (shown as «MYSELF - ALWAYS»). */
export interface NotifyCoach {
  who: string;
  type: string;
}

export interface NotificationItem {
  id: string;
  type: NotifyType;
  text: string;
  /** YYYY-MM-DD — shown as dd/mm/yy, no time of day (her page 10 note) */
  date: string;
  read: boolean;
}
