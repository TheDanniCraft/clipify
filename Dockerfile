# -------------------------
# deps (install node_modules)
# -------------------------
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY patches ./patches

RUN --mount=type=cache,target=/root/.bun \
    bun install --frozen-lockfile


# -------------------------
# builder (build Next standalone)
# -------------------------
FROM oven/bun:1 AS builder
WORKDIR /app
ARG COOLIFY_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run app:build


# -------------------------
# runner (production)
# -------------------------
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV INFISICAL_API_URL=https://infisical.thedannicraft.de
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Buildx provides this automatically
ARG TARGETARCH
# Pin Infisical for reproducible builds
ARG INFISICAL_VERSION=0.43.46

# Minimal OS deps + user creation
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    adduser && \
    rm -rf /var/lib/apt/lists/* && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install Infisical CLI
RUN set -eux; \
    case "${TARGETARCH}" in \
    amd64) INF_ARCH="amd64" ;; \
    arm64) INF_ARCH="arm64" ;; \
    *) echo "Unsupported arch: ${TARGETARCH}" && exit 1 ;; \
    esac; \
    curl -fsSL \
    "https://github.com/Infisical/cli/releases/download/v${INFISICAL_VERSION}/cli_${INFISICAL_VERSION}_linux_${INF_ARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin; \
    chmod +x /usr/local/bin/infisical; \
    infisical --version

# App runtime files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000

CMD ["infisical", "run", "--projectId", "4bea168c-8d4c-4086-b755-f04fdc5305a1", "--command", "bun run db:migrate && bun server.js || sleep infinity"]
