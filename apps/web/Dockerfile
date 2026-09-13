# Built from the monorepo root: docker build -f apps/web/Dockerfile .
# Uses Next.js standalone output (see apps/web/next.config.ts) so the
# runner stage doesn't need node_modules at all.

FROM node:26-alpine AS base

FROM base AS pruner
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm dlx turbo prune @noizera/web --docker

FROM base AS installer
WORKDIR /app
RUN corepack enable
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@noizera/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
