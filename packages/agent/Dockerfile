# Multi-stage build for the ChamaAgent cron service.
# Built from the monorepo root: `docker build -f packages/agent/Dockerfile .`

FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/agent/package.json packages/agent/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --filter @chama/agent --frozen-lockfile

FROM node:24-alpine AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
ENV NODE_ENV=production

# Bring deps over
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/agent/node_modules ./packages/agent/node_modules
COPY pnpm-workspace.yaml package.json ./
COPY packages/agent/package.json packages/agent/

# Source + the deployment.json the agent reads chama/factory addresses from
COPY packages/agent/src packages/agent/src
COPY packages/agent/tsconfig.json packages/agent/
COPY packages/contracts/deployments packages/contracts/deployments

# tsx is what the dev/start scripts use to run TS at runtime
WORKDIR /app/packages/agent

# Drop privileges
RUN addgroup -S agent && adduser -S agent -G agent && chown -R agent:agent /app
USER agent

CMD ["pnpm", "tsx", "src/index.ts"]
