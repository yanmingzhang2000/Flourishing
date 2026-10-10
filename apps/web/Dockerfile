# Stage 1: Build
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy workspace package.json files
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web

# Build contracts (web depends on it)
RUN pnpm --filter @flourish/contracts build

# Build web app (Vite build)
RUN pnpm --filter @flourish/web build

# Stage 2: Production (nginx serves static build)
FROM nginx:1.25-alpine AS production

# Copy built static files to nginx html directory
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy custom nginx config (optional, for SPA routing)
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
