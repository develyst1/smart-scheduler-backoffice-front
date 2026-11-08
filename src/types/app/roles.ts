// The three back-office roles (SPEC-097 §1). Lower-case, exactly these — the same strings the token's `role` carries.
export type Role = "ceo" | "admin" | "coach";

export const ROLES: Role[] = ["ceo", "admin", "coach"];

export const ROLE_LABEL: Record<Role, string> = { ceo: "CEO", admin: "Admin", coach: "Coach" };

export const isRole = (v: unknown): v is Role => v === "ceo" || v === "admin" || v === "coach";

/** What `POST /auth/login` returns (SPEC-097 §3). */
export interface SessionUser {
  username: string;
  role: Role;
  teacherId: number | null;
}
