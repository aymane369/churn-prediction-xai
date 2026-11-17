# Frontend image, two stages:
#   1. build the React/TypeScript app with Node (type errors fail the build)
#   2. serve the static result with nginx (unprivileged: non-root, listens on 8080)
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first so this layer is cached until package files change
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.inc /etc/nginx/security-headers.inc
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
