# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install all deps (incl. dev) so we can generate the Prisma client + build.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy the full dependency tree (includes the prisma CLI, needed for
# `prisma migrate deploy` as Render's pre-deploy step) plus the build output.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Render injects PORT at runtime; main.ts reads it via ConfigService.
# Render's free tier has no Pre-Deploy hook, so migrations run at startup.
# `migrate deploy` is idempotent — a no-op when the DB is already up to date —
# and fails fast (server won't boot) if a migration can't apply, which is the
# behaviour we want. The prisma CLI is present because the runtime image copies
# the full node_modules from the builder stage.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
