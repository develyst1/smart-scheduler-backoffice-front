import { api } from "@/lib/api/client";
import type { SessionUser } from "@/types/app/roles";

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

// Back-office login (SPEC-097 §3): POST /api/v1/auth/login → { token, user: { username, role, teacherId } }.
export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/v1/auth/login", { username, password });
  return data;
}
