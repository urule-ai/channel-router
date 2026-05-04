# syntax=docker/dockerfile:1
# Build context: urule-repos/ (parent of urule and the standalone). Compose:
#   build:
#     context: ../../..
#     dockerfile: channel-router/Dockerfile
#
# Workspace deps (@urule/auth-middleware, @urule/correlation-id,
# @urule/observability) are referenced as `file:..` paths in package.json and
# resolved here via copies into the build context. Caller is expected to have
# run `npm --prefix urule run build:all` so the consumed dist/ directories
# are populated before `docker compose build`.

FROM node:20-slim AS builder
WORKDIR /app
COPY urule/packages/auth-middleware/package.json urule/packages/auth-middleware/package.json
COPY urule/packages/auth-middleware/dist urule/packages/auth-middleware/dist
COPY urule/packages/correlation-id/package.json urule/packages/correlation-id/package.json
COPY urule/packages/correlation-id/dist urule/packages/correlation-id/dist
COPY urule/packages/observability/package.json urule/packages/observability/package.json
COPY urule/packages/observability/dist urule/packages/observability/dist
COPY channel-router/package.json channel-router/package-lock.json channel-router/
WORKDIR /app/channel-router
RUN npm ci --install-links
WORKDIR /app
COPY channel-router/tsconfig.json channel-router/tsconfig.json
COPY channel-router/src channel-router/src
WORKDIR /app/channel-router
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY urule/packages/auth-middleware/package.json urule/packages/auth-middleware/package.json
COPY urule/packages/auth-middleware/dist urule/packages/auth-middleware/dist
COPY urule/packages/correlation-id/package.json urule/packages/correlation-id/package.json
COPY urule/packages/correlation-id/dist urule/packages/correlation-id/dist
COPY urule/packages/observability/package.json urule/packages/observability/package.json
COPY urule/packages/observability/dist urule/packages/observability/dist
COPY channel-router/package.json channel-router/package-lock.json channel-router/
WORKDIR /app/channel-router
RUN npm ci --install-links --omit=dev
COPY --from=builder /app/channel-router/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
