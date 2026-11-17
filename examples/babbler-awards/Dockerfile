FROM oven/bun:1.4.4-alpine AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
COPY vendor/ ./vendor/
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM node:26.13.0-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src/ ./src/
USER node
ENTRYPOINT ["node", "src/cli.mjs"]
CMD ["search"]
