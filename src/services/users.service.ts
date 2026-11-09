// Back-office logins — the data seam (TASK-931, R0.1). WIRED to TASK-930 AS DEPLOYED: `USERS_SOURCE.users` is "api"; the stateful fixture (which behaves the way 930, option 2, says) stays behind it for the tests.
// A person who already has a FRONT-OFFICE login is ADMITTED with a role and signs in with their front-office password — the back office has no password of its own, so none is typed, sent or kept here.
//   GET /v1/users → a bare ARRAY of {id, username, role, teacherId, active, admitted, createdAt}   (the route's own header; `{items}` is also accepted)
//   POST /v1/users {username, role, teacherId?} → 201 the row · POST /v1/users/:id/deactivate → the row · POST /v1/users/:id/reactivate → the row.   CEO ONLY (hide, never mask).
//   errors (the envelope): 404 NOT_FOUND (not in the front office) · 409 ALREADY_ADMITTED · 400 VALIDATION with `error.details.field` = username | role | teacherId (the screen reads it as it comes: no guessing).
import { api, ApiClientError } from "@/lib/api/client";
import { FO_USERS_FIXTURE, USERS_FIXTURE } from "@/services/__fixtures__/users";
import type { Role } from "@/types/app/roles";
import type { AdmitLoginInput, LoginUser } from "@/types/app/users";

export const USERS_SOURCE: Record<"users", "fixture" | "api"> = { users: "api" };
const live = () => USERS_SOURCE.users === "api";

let store: LoginUser[] = structuredClone(USERS_FIXTURE);
let seq = 100;
/** Tests only: put the fixture back to its start. */
export function resetUsersFixture(): void {
  store = structuredClone(USERS_FIXTURE);
  seq = 100;
}

const ceoOnly = (role: Role | null) => {
  if (role !== "ceo") throw new ApiClientError("FORBIDDEN", "ไม่มีสิทธิ์จัดการบัญชีผู้ใช้", 403);
};
const bad = (message: string, field: string) => new ApiClientError("VALIDATION", message, 400, { field });
const byName = (a: LoginUser, b: LoginUser) => a.username.localeCompare(b.username);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The logins, by username. No password, no hash — a row has neither. */
export async function listLogins(role: Role | null): Promise<LoginUser[]> {
  ceoOnly(role);
  if (live()) {
    const { data } = await api.get<LoginUser[] | { items?: LoginUser[] }>("/v1/users");
    const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return [...rows].sort(byName);
  }
  return structuredClone([...store].sort(byName));
}

/**
 * Admit a front-office person. 404 when the username is not in the front office; 409 when they are already admitted; 400 when the role is not admin/coach or a coach has no teacher
 * (the front-office row's own `teacher_id` is used, so `teacherId` is needed only when that row has none). The answer is the new row.
 */
export async function admitLogin(input: AdmitLoginInput, role: Role | null): Promise<LoginUser> {
  ceoOnly(role);
  if (live()) {
    // the body is exactly username + role (+ teacherId for a coach): there is no password key in it, ever
    const body = { username: input.username.trim(), role: input.role, ...(input.role === "coach" && input.teacherId ? { teacherId: input.teacherId } : {}) };
    const { data } = await api.post<LoginUser>("/v1/users", body);
    return data;
  }
  const username = input.username.trim();
  if (!username) throw bad("ต้องใส่ชื่อผู้ใช้", "username");
  if (input.role !== "admin" && input.role !== "coach") throw bad("role ต้องเป็น admin หรือ coach", "role");
  const fo = FO_USERS_FIXTURE.find((p) => same(p.username, username));
  if (!fo) throw new ApiClientError("FO_USER_NOT_FOUND", `ไม่พบ «${username}» ในระบบหน้าบ้าน`, 404, { field: "username" });
  if (store.some((u) => same(u.username, fo.username))) throw new ApiClientError("ALREADY_ADMITTED", `«${fo.username}» ได้รับสิทธิ์ใช้ระบบหลังบ้านแล้ว`, 409, { field: "username" });
  const teacherId = input.role === "coach" ? (fo.teacherId ?? input.teacherId ?? null) : null;
  if (input.role === "coach" && !teacherId) throw bad("ระบบหน้าบ้านไม่ได้ผูก «" + fo.username + "» กับครู: เลือกครูที่ตรงกัน", "teacherId");
  const row: LoginUser = { id: `u${++seq}`, username: fo.username, role: input.role, teacherId, active: true, createdAt: new Date().toISOString() };
  store.push(row);
  return structuredClone(row);
}

const find = (id: string): LoginUser => {
  const u = store.find((x) => x.id === id);
  if (!u) throw new ApiClientError("NOT_FOUND", "ไม่พบบัญชีผู้ใช้นี้", 404);
  return u;
};

/** Soft-disable a login: it can no longer sign in and stays in the list (never deleted). 404 for an unknown login. */
export async function deactivateLogin(id: string, role: Role | null): Promise<LoginUser> {
  ceoOnly(role);
  if (live()) {
    const { data } = await api.post<LoginUser>(`/v1/users/${encodeURIComponent(id)}/deactivate`);
    return data;
  }
  const u = find(id);
  u.active = false;
  return structuredClone(u);
}

/** Bring a deactivated login back. 404 for an unknown login. */
export async function reactivateLogin(id: string, role: Role | null): Promise<LoginUser> {
  ceoOnly(role);
  if (live()) {
    const { data } = await api.post<LoginUser>(`/v1/users/${encodeURIComponent(id)}/reactivate`);
    return data;
  }
  const u = find(id);
  u.active = true;
  return structuredClone(u);
}
