import { useAuthStore } from "@/store/auth-store";
import type { ApiError, AuthUser } from "@/lib/types";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!response.ok) return false;
    const payload = await response.json() as { data?: { accessToken: string; user: AuthUser } };
    if (!payload.data) return false;
    useAuthStore.getState().setSession(payload.data.accessToken, payload.data.user);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: "include", cache: "no-store" });
  if (response.status === 401 && retry && path !== "/auth/login" && path !== "/auth/register" && await refreshSession()) {
    return apiFetch<T>(path, init, false);
  }
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as T & ApiError;
  if (!response.ok) {
    throw new ApiRequestError(payload.error?.message ?? "The request could not be completed", response.status, payload.error?.code);
  }
  return payload;
}

export async function initializeSession(): Promise<void> {
  await refreshSession();
  useAuthStore.getState().setReady();
}

export function apiBaseUrl(): string {
  return baseUrl;
}
