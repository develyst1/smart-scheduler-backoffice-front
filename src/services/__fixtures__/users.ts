// Back-office logins — fixtures of TASK-930's `GET /v1/users` and of the front-office people it can admit (TASK-931). ONLY `users.service.ts` imports this file; no component does.
// 🟡 Invented names (CONVENTIONS §2.8). There is NO password or hash anywhere in it, by design (the password stays in the front office). The wiring TASK swaps the service body and deletes this file.
import type { LoginUser } from "@/types/app/users";

export const USERS_FIXTURE: LoginUser[] = [
  { id: "u1", username: "phin", role: "ceo", teacherId: null, active: true, createdAt: "2026-10-01T03:00:00.000Z" },
  { id: "u2", username: "kung", role: "admin", teacherId: null, active: true, createdAt: "2026-10-05T03:00:00.000Z" },
  { id: "u3", username: "ton", role: "coach", teacherId: "11111111-1111-4111-8111-111111111111", active: true, createdAt: "2026-10-12T03:00:00.000Z" },
  { id: "u4", username: "mali", role: "admin", teacherId: null, active: false, createdAt: "2026-10-20T03:00:00.000Z" },
];

/** Who has a front-office login (`public.users`) and the teacher the front office links them to (null = the front-office row has none). Only these can be admitted. */
export const FO_USERS_FIXTURE: { username: string; teacherId: string | null }[] = [
  { username: "kung", teacherId: null },
  { username: "ton", teacherId: "11111111-1111-4111-8111-111111111111" },
  { username: "nok", teacherId: null },
  { username: "nid", teacherId: "22222222-2222-4222-8222-222222222222" },
  { username: "bee", teacherId: null },
];
