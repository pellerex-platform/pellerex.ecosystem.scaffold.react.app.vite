// Minimal API helper. Reads the base URL from runtime config (window.__PELLEREX_ENV__) and attaches
// the end user's OIDC access token to outbound calls (Mode 1 — the call goes to the tenant's OWN
// backend, which validates the token; CORS is the backend's concern, WA-R9).
// Every call also carries a correlation id in X-Correlation-Id, the header the platform and its API
// templates read: one id for the call and everything done for it, so its log lines can be found
// together. A backend that lists the headers it accepts for CORS has to accept this one too.

import { env } from "../config/env";
import { getAccessToken } from "../auth/oidc";

const CORRELATION_ID_HEADER = "X-Correlation-Id";

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = env.apiBaseUrl.replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${base}/${path.replace(/^\//, "")}`;

  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has(CORRELATION_ID_HEADER)) headers.set(CORRELATION_ID_HEADER, crypto.randomUUID());

  return fetch(url, { ...init, headers });
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`API call failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}
