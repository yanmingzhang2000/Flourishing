# Stage 1: Build
FROM node:20-alpine AS builder

# Install build dependencies (required for better-sqlite3 native binding)
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy root workspace files (required for findRepoRoot() in config)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all workspace package.json files
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/training-domain/package.json ./packages/training-domain/
COPY apps/server/package.json ./apps/server/

# Install all dependencies (including dev deps for build, better-sqlite3 compiles here)
RUN pnpm install --frozen-lockfile

# Copy source code and data
COPY packages/contracts ./packages/contracts
COPY packages/training-domain ./packages/training-domain
COPY apps/server ./apps/server
COPY data ./data

# Build all packages
RUN pnpm --filter @flourish/contracts build
RUN pnpm --filter @flourish/training-domain build
RUN pnpm --filter @flourish/server build

# Stage 2: Production (minimal image with runtime deps only)
FROM node:20-alpine AS production

# Install runtime dependencies for better-sqlite3 (libstdc++ for C++ bindings)
# and wget for healthcheck
RUN apk add --no-cache libstdc++ wget

WORKDIR /app

# Copy workspace root files (required for config.ts findRepoRoot)
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./

# Copy built server artifacts
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=builder /app/apps/server/package.json ./apps/server/

# Copy built dependencies (contracts, training-domain)
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/
COPY --from=builder /app/packages/training-domain/dist ./packages/training-domain/dist
COPY --from=builder /app/packages/training-domain/package.json ./packages/training-domain/

# Copy node_modules (prod deps + better-sqlite3 bindings)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=builder /app/packages/training-domain/node_modules ./packages/training-domain/node_modules

# Copy exercise library data
COPY --from=builder /app/data ./data

# Create database directory
RUN mkdir -p /app/data/db

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app/apps/server

EXPOSE 3000

# Run migrations, then start server
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
