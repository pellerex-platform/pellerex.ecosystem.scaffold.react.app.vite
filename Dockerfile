# syntax=docker/dockerfile:1
#
# Multi-stage build (WA-D2/D3): build the React app to static assets, then serve them from a pure
# nginx runtime. No Node runtime ships to production — the container is just nginx + static files.

# --- Build stage ---------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps against the committed lockfile for reproducible builds (WA-R7).
COPY package.json package-lock.json ./
RUN npm ci

# Build the static bundle into dist/.
COPY . .
RUN npm run build

# --- Runtime stage -------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Static bundle.
COPY --from=build /app/dist /usr/share/nginx/html

# nginx config (health endpoints + SPA fallback; 'listen <port-number>' -> 9000 at tokenisation).
COPY nginx.conf /etc/nginx/nginx.conf

# Runtime env injection (WA-D7): the stock nginx entrypoint runs /docker-entrypoint.d/*.sh before
# starting nginx, so env.sh writes env.js from environment variables at container start.
COPY docker-entrypoint.d/env.sh /docker-entrypoint.d/40-pellerex-env.sh
RUN chmod +x /docker-entrypoint.d/40-pellerex-env.sh

# Tokenised to 9000 — the platform port contract.
EXPOSE <port-number>

# Inherit nginx:alpine's ENTRYPOINT (docker-entrypoint.sh) + CMD (nginx -g 'daemon off;').
