// TASK-914 — fixtures for the Notification pages (final-ui `mock/a-notify.ts`, typed). ONLY `notification.service.ts` imports this file; no component does.
// An Admin's feed items carry NO money (R0). Names are invented (CONVENTIONS §2.8). Deleted when the real store lands.
import { NOTIFY_TYPES, type NotificationItem, type NotifyCoach, type NotifyRecipient } from "@/types/app/notification";

/** Who is told about what (REQ-120 R0.4, today): the CEO gets ALL six; the person the customer called London (Beam here) gets Low Stock; the rest as the final UI shows. Role-derived — no opt-out (ruling C-h). */
export const RECIPIENTS_FIXTURE: NotifyRecipient[] = [
  { who: "CEO", role: "CEO", gets: [...NOTIFY_TYPES] },
  { who: "Beam", role: "Admin", gets: ["Low Stock"] },
  { who: "Ploy", role: "Admin", gets: ["Bonus"] },
];

export const COACHES_FIXTURE: NotifyCoach[] = [
  { who: "Pete", type: "Full-time" },
  { who: "May", type: "Full-time" },
  { who: "Ton", type: "Part-time + Freelance" },
];

export const FEED_CEO_FIXTURE: NotificationItem[] = [
  { id: "c1", type: "Bonus", text: "For 50 : น้องมะลิ (Private) + น้องภูมิ (Voucher) = 2 · Pete", date: "2026-10-21", read: false },
  { id: "c2", type: "Commission", text: "Skate bag × 1 · Ploy", date: "2026-10-16", read: false },
  { id: "c3", type: "Transportation", text: "STA · 12 km · round trip · car → 24 km × 6 ฿ = 144 ฿ · Ton", date: "2026-10-14", read: false },
  { id: "c4", type: "OT", text: "OT 3 Hr · Pete · enter manually by Ploy", date: "2026-10-20", read: false },
  { id: "c5", type: "Other", text: "Pete · reason: ทำอุปกรณ์เสีย", date: "2026-10-20", read: false },
  { id: "c6", type: "Low Stock", text: "Miller helmet — M: 4 left (limit 5)", date: "2026-10-19", read: false },
  { id: "c7", type: "Extra Hour", text: "(Sat) : 7 Hr → ชม.ที่ 6–7 = 2 Hr × 350 ฿ · Ton", date: "2026-10-10", read: false },
];

export const FEED_ADMIN_FIXTURE: NotificationItem[] = [
  { id: "a1", type: "Low Stock", text: "Miller helmet — M: 4 left (limit 5)", date: "2026-10-19", read: false },
  { id: "a2", type: "Low Stock", text: "Water 600 ml: 8 left (limit 10)", date: "2026-10-19", read: false },
  { id: "a3", type: "Bonus", text: "For 50 : น้องมะลิ (Private) + น้องภูมิ (Voucher) = 2 · Pete", date: "2026-10-21", read: false },
];
