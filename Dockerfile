# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Your Eyes In The Space — production image for Google Cloud Run
#   stage 1: build the static bundle with Vite
#   stage 2: serve it with nginx (listens on $PORT, Cloud Run injects it)
# ---------------------------------------------------------------------------

FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
# BUILD_ID is baked into cache-busting query strings for /data and /models
ARG BUILD_ID
ENV BUILD_ID=${BUILD_ID}
RUN npm run build

# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
# nginx:alpine runs envsubst over /etc/nginx/templates/*.template at start-up
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run sets PORT (default 8080). ORIGIN_AUTH_SECRET is optional: when set, requests
# without a matching X-Origin-Auth header (added by a Cloudflare transform rule) get 403,
# so the Cloud Run URL cannot be hit directly, bypassing the WAF.
ENV PORT=8080 \
    ORIGIN_AUTH_SECRET=""
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/_health" >/dev/null || exit 1
