import { api } from "@/lib/api/client";

export interface LoginResponse {
  token: string;
  user: { username: string; role: string };
}

// Ops admin login (SPEC-003 / TASK-013): POST /api/v1/auth/login → { token, user }.
export async function login(username: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/v1/auth/login", { username, password });
  return data;
}
