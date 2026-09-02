FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# `prisma generate` (needed by prisma/schema.prisma) reads these before npm ci's postinstall runs.
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall (`prisma generate`) requires DATABASE_URL to resolve prisma.config.ts, but
# generate only reads the schema and never connects to the DB, so a dummy value is fine.
ARG DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV DATABASE_URL=$DATABASE_URL
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generated client from the deps stage takes precedence over any stale local ./generated
# that might otherwise be picked up by `COPY . .` outside a clean CI checkout.
COPY --from=deps /app/generated ./generated
# `next build` evaluates lib/prisma.ts at module load (adapter construction), so keep
# DATABASE_URL set here too even though no query actually runs during the build.
ARG DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV DATABASE_URL=$DATABASE_URL
# NEXT_PUBLIC_* variables are inlined into the client bundle at build time, so (unlike
# DATABASE_URL) they must be real values here — setting them later via `gcloud run deploy
# --set-env-vars` has no effect on an already-built bundle.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
EXPOSE 8080

CMD ["node", "server.js"]
