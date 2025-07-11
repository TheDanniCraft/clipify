# Base
FROM oven/bun:slim AS base

RUN apt-get update && \
    apt-get install -y bash curl gnupg && \
    curl -1sLf 'https://artifacts-cli.infisical.com/setup.deb.sh' | bash && \
    apt-get update && \
    apt-get install -y infisical && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV INFISICAL_API_URL=https://infisical.thedannicraft.de

FROM base AS deps
WORKDIR /app
COPY package.json bun.lockb ./

RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run app:build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs

EXPOSE 3000

ENV PORT=3000

ENV HOSTNAME="0.0.0.0"

CMD ["infisical", "run", "--projectId", "4bea168c-8d4c-4086-b755-f04fdc5305a1", "--command", "bun run db:migrate && bun server.js || sleep infinity"]
