// Lightweight admin session for the backoffice (SPEC-003 / TASK-014). The real
// security boundary is the ops API verifying this JWT; the cookie just carries it.
// JS-readable (not httpOnly) so both proxy.ts (server) and the axios interceptor
// (client) can read it — acceptable for an internal single-admin tool.

import { isRole, type SessionUser } from "@/types/app/roles";

const TOKEN_COOKIE = "bo_token";
const TTL_SECONDS = 12 * 60 * 60; // ~12h, matches the ops JWT TTL default

export function setToken(token: string) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${TTL_SECONDS}; SameSite=Lax${secure}`;
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)bo_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function clearToken() {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** The signed-in user from the token's claims `{sub, role, teacherId}` (SPEC-097 §3). Display and gating only — not trusted; null if the token is missing, unreadable or has no valid role. */
export function getClaims(): SessionUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = decodeURIComponent(
      Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
    );
    const claims = JSON.parse(json) as { sub?: string; role?: unknown; teacherId?: number | null };
    if (!claims.sub || !isRole(claims.role)) return null;
    return { username: claims.sub, role: claims.role, teacherId: claims.teacherId ?? null };
  } catch {
    return null;
  }
}

/** Only allow same-origin relative redirects (block protocol-relative / absolute). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
