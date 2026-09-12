# Built from the monorepo root: docker build -f apps/api/Dockerfile .
# Same image serves three roles selected by APP_ROLE at runtime (api,
# worker-media, worker-general) — tech proposal §2. ffmpeg/ffprobe are
# installed here because worker-media needs them as subprocesses,
# invoked never linked (tech proposal §1).

FROM node:22-alpine AS base

FROM base AS pruner
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm dlx turbo prune @noizera/api --docker

FROM base AS installer
WORKDIR /app
RUN corepack enable
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@noizera/api

FROM base AS runner
WORKDIR /app
# Pin the ffmpeg build per tech proposal §11.3 "worth pinning" — verify
# this is still the desired Alpine ffmpeg version before relying on it.
RUN apk add --no-cache ffmpeg dumb-init
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=installer --chown=nestjs:nodejs /app .
USER nestjs
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/main.js"]
