// Back-office logins (TASK-931, R0.1) — the types of TASK-930's `/v1/users` routes, option 2 (SPEC-097 §3 "same login"): the back office does NOT own a password. A person is ADMITTED: someone who already
// has a front-office login (`public.users`) is granted a back-office role, and signs in with their FRONT-OFFICE password. So there is NO password in any type below, and nothing on the screen can hold one.
import type { Role } from "@/types/app/roles";

/** The roles a login can be given here. The CEO is seeded, not admitted (TASK-930). */
export type LoginRole = "admin" | "coach";

/** One row of `GET /v1/users` (the deployed route answers a bare array of these; the seam also accepts `{ items }`). `teacherId` is a uuid STRING (not the stale number of `SessionUser`); null for an admin / the CEO. */
export interface LoginUser {
  id: string;
  username: string;
  role: Role;
  teacherId: string | null;
  active: boolean;
  /** ISO instant */
  createdAt?: string;
  /** true for a person admitted from the front office (the seeded CEO is not); the screen does not need it */
  admitted?: boolean;
}

/**
 * `POST /v1/users` body: admit an existing front-office person. No password. `teacherId` is for a coach: the back end defaults it from the front-office row's `teacher_id`, so it is sent only when
 * that row has none (the screen asks for it after a 400 on `teacherId`).
 */
export interface AdmitLoginInput {
  username: string;
  role: LoginRole;
  teacherId?: string;
}
