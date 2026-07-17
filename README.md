# React + Vite App Scaffold (Pellerex Managed App Service)

A client-side React app, built with Vite, served as static assets on **nginx**, and reached through
**ProxyApi** as an anonymous route at `https://app.pellerex.com/proxy/{ProductName}/{env}/`. There is
**no Node runtime in production** — the container is pure nginx + the built bundle.

This is the template for the **Managed App Service** product. It mirrors the platform contract the
.NET/Go API scaffolds use (port `9000` via the `<port-number>` token, `/health/{startup,live,ready}`
health endpoints, runtime config injection), with the differences a static SPA needs.

## What's in here

| Path | Purpose |
|---|---|
| `src/` | React app — routing, a sample API helper, a generic OIDC (PKCE) login helper |
| `index.html` | Loads `env.js`, then resolves the runtime base path so assets work under any prefix |
| `public/env.js` | Dev/fallback runtime config (overwritten in the container by `env.sh`) |
| `nginx.conf` | `listen <port-number>` (→ 9000), exact-match health endpoints, SPA fallback |
| `Dockerfile` | Multi-stage: `node build` → `nginx:alpine` runtime |
| `docker-entrypoint.d/env.sh` | Writes `env.js` from env vars at container start (build once, run everywhere) |
| `infrastructure/Helm/` | `Deployment` + `Service` (ClusterIP) + per-env values; health probes; **no Ingress** |
| `infrastructure/azure-containers-pipelines.yml` | CI: `npm ci` → build → docker → push |

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
```

Edit `public/env.js` for local runtime config. In the container this file is replaced at start by
`docker-entrypoint.d/env.sh` from environment variables.

## Runtime config (no secrets!)

A static SPA ships everything to the browser, so **no secret may ever reach the web tier** (WA-D9).
Only public values are injected, via `window.__PELLEREX_ENV__` in `env.js`:

| Key | Meaning |
|---|---|
| `apiBaseUrl` | Backend base URL the app calls (in v1/Mode 1 this is the tenant's OWN backend) |
| `oidcIssuer` / `oidcClientId` / `oidcAudience` / `oidcRedirectUri` | Tenant IDP (e.g. Auth0) — public client, PKCE, no secret |
| `environment` | `qualityassurance` / `staging` / `production` |
| `appInsightsConnectionString` | Browser RUM (optional) |
| `basePath` | Usually empty — derived from the URL at runtime |

## Auth (v1 = Mode 1)

The app logs the user into the **tenant's own IDP** (Auth0 or any OIDC provider) via Authorization
Code + PKCE and calls the **tenant's own backend** with that token. Those calls do not traverse
Pellerex; CORS is the backend's concern. (Pellerex-hosted APIs honouring third-party tokens is a
later phase — Mode 2.)

## How it's reached

The pod is a `ClusterIP` `Service` with **no Ingress of its own**. ProxyApi serves it anonymously at
`app.pellerex.com/proxy/{ProductName}/{env}/` and strips that prefix before forwarding to nginx.
nginx does the SPA deep-link fallback (`try_files … /index.html`).
