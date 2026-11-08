"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getClaims } from "@/lib/auth";
import type { Role, SessionUser } from "@/types/app/roles";

interface RoleCtx {
  /** null until the token has been read (after mount) — render nothing role-specific then */
  user: SessionUser | null;
  ready: boolean;
}
const Ctx = createContext<RoleCtx>({ user: null, ready: false });

/** The role comes from the signed-in token (display and gating only — the API is the security boundary). Read after mount so SSR (no cookie) and the client agree. */
export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RoleCtx>({ user: null, ready: false });
  useEffect(() => {
    setState({ user: getClaims(), ready: true });
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useSession = (): RoleCtx => useContext(Ctx);
/** The signed-in role, or null while loading / when the token has no valid role. */
export const useRole = (): Role | null => useContext(Ctx).user?.role ?? null;
