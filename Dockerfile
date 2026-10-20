# syntax=docker/dockerfile:1
#
# Multi-stage build (WA-D2/D3): build the React app to static assets, then serve them from a pure
# nginx runtime. No Node runtime ships to production — the container is just nginx + static files.

# --- Dependencies stage --------------------------------------------------------------------
# The Node toolchain and the installed packages, shared by the build and unit-tests stages.
FROM node:20-alpine AS dependencies
WORKDIR /app

# Install deps against the committed lockfile for reproducible builds (WA-R7).
COPY package.json package-lock.json ./
RUN npm ci

# --- Build stage ---------------------------------------------------------------------------
FROM dependencies AS build

# Build the static bundle into dist/.
COPY . .
RUN npm run build

# --- Unit tests stage ----------------------------------------------------------------------
# Not part of the default build: only a build that names this stage, or the unit-test-results
# stage below, runs it. It starts from the dependencies stage rather than from the build stage,
# because the build type-checks every file under src/, tests included, so a test that does not
# compile would stop that stage before any result was kept.
FROM dependencies AS unit-tests
COPY . .

# Runs the unit tests (Vitest) with line coverage: JUnit XML into unit-tests/, the one Cobertura
# file into coverage/, and the test command's exit code into unit-tests-exit-code. The RUN always
# succeeds, so the results are kept when a test fails; the builds upload them, then stop when the
# code is not 0. A coverage file cut short (one that does not end with its closing </coverage>)
# is removed rather than left half written, so the test results are still read; the exit code
# stays as the tests left it.
RUN mkdir -p /unit-test-results/test-coverage/unit-tests /unit-test-results/test-coverage/coverage; \
    npm test -- --reporter=default --reporter=junit \
      --outputFile.junit=/unit-test-results/test-coverage/unit-tests/junit.xml \
      --coverage.enabled --coverage.include='src/**' --coverage.reporter=cobertura \
      --coverage.reportOnFailure --coverage.reportsDirectory=/unit-test-results/test-coverage/coverage; \
    echo $? > /unit-test-results/unit-tests-exit-code; \
    coverage_file=/unit-test-results/test-coverage/coverage/cobertura-coverage.xml; \
    if [ -f "$coverage_file" ] && ! tail -c 64 "$coverage_file" | grep -q '</coverage>'; then \
      rm -f "$coverage_file"; \
    fi

# --- Unit test results stage ---------------------------------------------------------------
# The results alone, never an image. The builds export it to a folder outside the checkout
# (docker buildx build --target unit-test-results with a local output), which puts
# test-coverage/ and unit-tests-exit-code at the root of that folder.
FROM scratch AS unit-test-results
COPY --from=unit-tests /unit-test-results /

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
