FROM oven/bun:1
WORKDIR /app

# ── Minimal workspace (only shared + microservice) ───────
COPY packages/shared/package.json packages/shared/
COPY packages/microservice/package.json packages/microservice/
RUN echo '{"workspaces":["packages/*"]}' > package.json

# ── Source code ──────────────────────────────────────────
COPY packages/shared/ packages/shared/
COPY packages/microservice/ packages/microservice/

# ── Install (no frozen-lockfile — trimmed workspace) ─────
RUN bun install

WORKDIR /app/packages/microservice

CMD ["bun", "run", "src/main.ts"]
