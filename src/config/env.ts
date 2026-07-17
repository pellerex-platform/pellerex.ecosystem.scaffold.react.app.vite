// Typed accessor for the runtime config injected by docker-entrypoint.d/env.sh into env.js
// (WA-D7). ONLY public values live here — never a secret (WA-D9).
//
// The agreed key set (must match env.sh and the scaffold): apiBaseUrl, oidcIssuer, oidcClientId,
// oidcAudience, oidcRedirectUri — plus environment, appInsightsConnectionString, basePath.

export interface PellerexEnv {
  /** Base URL the app calls its backend API at. In v1 (Mode 1) this is the tenant's OWN backend. */
  apiBaseUrl: string;
  /** OIDC issuer of the tenant's IDP (e.g. Auth0 domain URL). Public. */
  oidcIssuer: string;
  /** OIDC public client id. Public (this is a public client — PKCE, no secret). */
  oidcClientId: string;
  /** OIDC audience for access tokens. Public. */
  oidcAudience: string;
  /** OIDC redirect URI registered with the IDP. Public. */
  oidcRedirectUri: string;
  /** Environment name (qa/staging/production). */
  environment: string;
  /** App Insights connection string for browser RUM. Public (not a KeyVault secret). */
  appInsightsConnectionString: string;
  /** Optional explicit base path; when empty it is derived from the URL at runtime. */
  basePath: string;
}

declare global {
  interface Window {
    __PELLEREX_ENV__?: Partial<PellerexEnv>;
    /** Resolved router/asset base path (set by the bootstrap in index.html). */
    __PELLEREX_BASE_PATH__?: string;
  }
}

const raw = window.__PELLEREX_ENV__ ?? {};

export const env: PellerexEnv = {
  apiBaseUrl: raw.apiBaseUrl ?? "",
  oidcIssuer: raw.oidcIssuer ?? "",
  oidcClientId: raw.oidcClientId ?? "",
  oidcAudience: raw.oidcAudience ?? "",
  oidcRedirectUri: raw.oidcRedirectUri ?? resolveRedirectUri(),
  environment: raw.environment ?? "development",
  appInsightsConnectionString: raw.appInsightsConnectionString ?? "",
  basePath: raw.basePath ?? "",
};

/** Router basename: the path prefix the app is served under, e.g. /proxy/{ProductName}/{env}. */
export const basename: string = window.__PELLEREX_BASE_PATH__ ?? "";

/** Default OIDC redirect to the app's own callback route under the resolved base path. */
function resolveRedirectUri(): string {
  const base = window.__PELLEREX_BASE_PATH__ ?? "";
  return `${window.location.origin}${base}/callback`;
}

/** True when the tenant has supplied enough OIDC config to attempt a login. */
export const isOidcConfigured: boolean = Boolean(env.oidcIssuer && env.oidcClientId);
