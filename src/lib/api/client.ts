import axios from "axios";
import type { ApiError } from "@/types/api/contract";
import { clearToken, getToken } from "@/lib/auth";

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const baseURL =
  process.env.NEXT_PUBLIC_BACKOFFICE_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4010/api";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

// Attach the admin JWT (SPEC-003 / TASK-014). Token lives in the bo_token cookie.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url: string = error.config?.url ?? "";
    // Expired/invalid token on a guarded call → drop the session and send to login.
    // Skip for the login call itself so the page can show "wrong credentials".
    if (status === 401 && typeof window !== "undefined" && !url.includes("/auth/login")) {
      clearToken();
      const next = window.location.pathname + window.location.search;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
    const body = error.response?.data as ApiError | undefined;
    if (body?.error) {
      throw new ApiClientError(body.error.code, body.error.message, error.response.status);
    }
    throw error;
  },
);
