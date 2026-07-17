#!/bin/sh
# Runtime config injection (WA-D7). Runs via the stock nginx /docker-entrypoint.d mechanism BEFORE
# nginx starts, writing env.js from environment variables so ONE image promotes across QA/Staging/Prod.
#
# ONLY public values are written here — never a secret (WA-D9 / WA-R2). The key set MUST stay in sync
# with src/config/env.ts and public/env.js: apiBaseUrl, oidcIssuer, oidcClientId, oidcAudience,
# oidcRedirectUri, environment, appInsightsConnectionString, basePath.
set -eu

# Written to the /runtime-config emptyDir (nginx aliases env.js there), keeping the image
# html root — and the whole root filesystem — read-only. mkdir covers plain `docker run`
# without the mount; in-cluster the chart provides it.
TARGET="/runtime-config/env.js"
mkdir -p "$(dirname "$TARGET")"

cat > "$TARGET" <<EOF
window.__PELLEREX_ENV__ = {
  apiBaseUrl: "${API_BASE_URL:-}",
  oidcIssuer: "${OIDC_ISSUER:-}",
  oidcClientId: "${OIDC_CLIENT_ID:-}",
  oidcAudience: "${OIDC_AUDIENCE:-}",
  oidcRedirectUri: "${OIDC_REDIRECT_URI:-}",
  environment: "${ENVIRONMENT:-}",
  appInsightsConnectionString: "${APP_INSIGHTS_CONNECTION_STRING:-}",
  basePath: "${BASE_PATH:-}"
};
EOF

echo "[pellerex] wrote $TARGET for environment=${ENVIRONMENT:-unknown}"
