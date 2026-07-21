// Lightweight admin session for the backoffice (SPEC-003 / TASK-014). The real
// security boundary is the ops API verifying this JWT; the cookie just carries it.
// JS-readable (not httpOnly) so both proxy.ts (server) and the axios interceptor
// (client) can read it — acceptable for an internal single-admin tool.

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

/** Signed-in username, decoded from the JWT `sub` claim (display only — not trusted). */
export function getUser(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { sub?: string };
    return claims.sub ?? null;
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
