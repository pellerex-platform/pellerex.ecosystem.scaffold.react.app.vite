// Minimal API helper. Reads the base URL from runtime config (window.__PELLEREX_ENV__) and attaches
// the end user's OIDC access token to outbound calls (Mode 1 — the call goes to the tenant's OWN
// backend, which validates the token; CORS is the backend's concern, WA-R9).

import { env } from "../config/env";
import { getAccessToken } from "../auth/oidc";

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = env.apiBaseUrl.replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${base}/${path.replace(/^\//, "")}`;

  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  return fetch(url, { ...init, headers });
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`API call failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}
