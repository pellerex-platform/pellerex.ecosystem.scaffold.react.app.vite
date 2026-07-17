// Generic OIDC login helper — Authorization Code + PKCE for a PUBLIC client (Mode 1, WA-D18).
//
// Works with any standards-compliant IDP (Auth0 or otherwise) via OIDC discovery. The browser is a
// public client: there is NO client secret (PKCE replaces it), and only the end user's own token is
// ever held — never a baked-in credential (WA-D9). The user logs into the TENANT's IDP; the token is
// sent to the tenant's own backend, which validates it (Pellerex does no API-auth in v1).

import { env } from "../config/env";

const STORAGE = {
  verifier: "pellerex.oidc.code_verifier",
  state: "pellerex.oidc.state",
  accessToken: "pellerex.oidc.access_token",
  idToken: "pellerex.oidc.id_token",
  expiresAt: "pellerex.oidc.expires_at",
};

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
}

interface TokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in?: number;
}

let discoveryCache: OidcDiscovery | null = null;

async function discover(): Promise<OidcDiscovery> {
  if (discoveryCache) return discoveryCache;
  const issuer = env.oidcIssuer.replace(/\/$/, "");
  const res = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  discoveryCache = (await res.json()) as OidcDiscovery;
  return discoveryCache;
}

function randomString(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr.buffer);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
}

/** Begin the login: build a PKCE challenge and redirect the browser to the IDP. */
export async function login(): Promise<void> {
  const { authorization_endpoint } = await discover();
  const verifier = randomString();
  const state = randomString(16);
  const challenge = base64UrlEncode(await sha256(verifier));

  sessionStorage.setItem(STORAGE.verifier, verifier);
  sessionStorage.setItem(STORAGE.state, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.oidcClientId,
    redirect_uri: env.oidcRedirectUri,
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (env.oidcAudience) params.set("audience", env.oidcAudience);

  window.location.assign(`${authorization_endpoint}?${params.toString()}`);
}

/** Complete the login on the /callback route: exchange the code for tokens (PKCE, no secret). */
export async function handleRedirectCallback(): Promise<void> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) throw new Error(`IDP returned error: ${error}`);
  if (!code) throw new Error("No authorization code on the callback URL");

  const expectedState = sessionStorage.getItem(STORAGE.state);
  if (!returnedState || returnedState !== expectedState) {
    throw new Error("OIDC state mismatch — possible CSRF, aborting");
  }
  const verifier = sessionStorage.getItem(STORAGE.verifier);
  if (!verifier) throw new Error("Missing PKCE code verifier");

  const { token_endpoint } = await discover();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.oidcClientId,
    code,
    redirect_uri: env.oidcRedirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const token = (await res.json()) as TokenResponse;

  sessionStorage.setItem(STORAGE.accessToken, token.access_token);
  if (token.id_token) sessionStorage.setItem(STORAGE.idToken, token.id_token);
  const expiresAt = Date.now() + (token.expires_in ?? 3600) * 1000;
  sessionStorage.setItem(STORAGE.expiresAt, String(expiresAt));

  sessionStorage.removeItem(STORAGE.verifier);
  sessionStorage.removeItem(STORAGE.state);
}

export function getAccessToken(): string | null {
  const token = sessionStorage.getItem(STORAGE.accessToken);
  const expiresAt = Number(sessionStorage.getItem(STORAGE.expiresAt) ?? 0);
  if (!token || Date.now() >= expiresAt) return null;
  return token;
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/** Decode the id token payload (display only — never trust this for authorization). */
export function getUser(): Record<string, unknown> | null {
  const idToken = sessionStorage.getItem(STORAGE.idToken);
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function logout(): void {
  Object.values(STORAGE).forEach((k) => sessionStorage.removeItem(k));
  window.location.assign(window.__PELLEREX_BASE_PATH__ || "/");
}
