FROM oven/bun:1.4.2 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# These are public browser configuration values, not secrets. Vite embeds them
# in client assets at build time; server credentials are supplied only at runtime.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}

RUN test -n "$VITE_SUPABASE_URL" \
  && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" \
  && bun run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "./.output/server/index.mjs"]