import type { EntryPerson } from "@/types/app/salary";
import type { AdmitLoginInput, LoginRole, LoginUser } from "@/types/app/users";

// Pure rules of the Logins screen (TASK-931, option 2): admit a front-office person, deactivate / reactivate. No React, so they are unit-tested.
// 🔐 There is NO password anywhere: the person signs in with their front-office password, so the back office never asks for, sends or stores one.

export const ROLE_OPTIONS: { value: LoginRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "coach", label: "Coach" },
];

export const ROLE_WORD: Record<string, string> = { ceo: "CEO", admin: "Admin", coach: "Coach" };

export type FieldErrors = Partial<Record<"username" | "role" | "teacherId", string>>;

export const MSG = {
  username: "Enter the person's front-office username",
  teacher: "The front office has no teacher for this person: pick who they are",
} as const;

export interface AdmitForm {
  username: string;
  role: LoginRole;
  teacherId: string | null;
  /** the front office has no teacher link for this username (the server said so): the Person picker is shown and required */
  needsPerson: boolean;
}

/** The checks run before the request (the server checks them again: 404 / 409 / 400). The person is required only once the server has said the front office has none. */
export function validateAdmit(f: AdmitForm): FieldErrors {
  const e: FieldErrors = {};
  if (!f.username.trim()) e.username = MSG.username;
  if (f.role === "coach" && f.needsPerson && !f.teacherId) e.teacherId = MSG.teacher;
  return e;
}

/** The request body: the person goes with a coach ONLY, and only when one was picked (otherwise the back end uses the front office's own link). */
export function toAdmitInput(f: AdmitForm): AdmitLoginInput {
  return { username: f.username.trim(), role: f.role, ...(f.role === "coach" && f.teacherId ? { teacherId: f.teacherId } : {}) };
}

/**
 * Where a refusal belongs: 404 (the username is not in the front office) and 409 ALREADY_ADMITTED are the username field (matched on the HTTP status, not on the code); a 400 whose `error.details.field` names a form field is that field's error (the server's own sentence);
 * anything else is `rest` (shown once in the dialog). `needsPerson` is true when the 400 is about `teacherId`: the screen then shows the Person picker.
 */
export function fieldErrorsFromServer(error: unknown): { fields: FieldErrors; rest: string | null; needsPerson: boolean } {
  const e = error as { status?: unknown; message?: unknown; details?: unknown } | null;
  const message = typeof e?.message === "string" ? e.message : "เกิดข้อผิดพลาด";
  const field = (e?.details as { field?: unknown } | null | undefined)?.field;
  if (e?.status === 404 || e?.status === 409) return { fields: { username: message }, rest: null, needsPerson: false };
  if (e?.status === 400 && (field === "username" || field === "role" || field === "teacherId")) {
    return { fields: { [field]: message }, rest: null, needsPerson: field === "teacherId" };
  }
  return { fields: {}, rest: message, needsPerson: false };
}

/** A login may be deactivated while it is active, is not the CEO's and is not the signed-in user's own (nobody locks themselves out). */
export const canDeactivate = (row: LoginUser, me: string | null): boolean => row.active && row.role !== "ceo" && row.username !== me;

/** A deactivated login can be brought back. */
export const canReactivate = (row: LoginUser): boolean => !row.active;

/**
 * The person a coach login is linked to, by name: the name the login row itself carries (`teacherName`, when the back end sends one), else the people list's (it has no pay, but it lists only teachers with an
 * ACTIVE salary profile, so a coach without one is not in it); the id as the last resort; "—" for a login with no person.
 */
export function personName(row: LoginUser, people: readonly EntryPerson[]): string {
  if (!row.teacherId) return "—";
  return row.teacherName?.trim() || people.find((p) => p.teacherId === row.teacherId)?.name || row.teacherId;
}

/** The success toasts (Thai, as the other screens). */
export const TOAST = {
  admitted: (username: string) => `รับเข้าใช้งานเว็บหลังบ้านแล้ว: ${username} (เข้าสู่ระบบด้วยรหัสผ่านของหน้าบ้าน)`,
  deactivated: (username: string) => `ปิดการใช้งานบัญชี ${username} แล้ว (ยังเห็นในรายการ)`,
  reactivated: (username: string) => `เปิดการใช้งานบัญชี ${username} อีกครั้งแล้ว`,
};
