// DEVELOPMENT / FALLBACK runtime config.
//
// In the container this file is OVERWRITTEN by docker-entrypoint.d/env.sh from environment
// variables before nginx starts (WA-D7). It is committed only so `npm run dev` works locally.
// ONLY public values may ever appear here — no secrets reach the browser (WA-D9 / WA-R2).
window.__PELLEREX_ENV__ = {
  apiBaseUrl: "",
  oidcIssuer: "",
  oidcClientId: "",
  oidcAudience: "",
  oidcRedirectUri: "",
  environment: "development",
  appInsightsConnectionString: "",
  basePath: "",
};
