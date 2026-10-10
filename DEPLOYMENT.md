# Deployment Guide

This document describes how to deploy the Flourish AI Training application to production using Docker Compose.

## Prerequisites

- Docker Engine 24.0+ with Compose V2
- (Optional) A reverse proxy like Traefik, Caddy, or Nginx if deploying on a public server with HTTPS

## Quick Start (Local Production Simulation)

1. **Create `.env` file at repo root with required secrets:**

   ```bash
   # Required: JWT secret for authentication tokens (use strong random value in production)
   JWT_SECRET=your-secure-random-secret-min-32-chars
   
   # Optional: CORS origin (defaults to http://localhost)
   CORS_ORIGIN=http://localhost
   ```

   Generate a secure JWT secret:
   ```bash
   # Linux/macOS:
   openssl rand -base64 32
   
   # Windows PowerShell:
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   ```

2. **Build and start all services:**

   ```bash
   docker compose up -d --build
   ```

   This builds and starts:
   - `server` (backend API): http://localhost:3001
   - `web` (frontend): http://localhost:80

3. **Verify services:**

   ```bash
   # Check containers are healthy
   docker compose ps
   
   # Check server health endpoint
   curl http://localhost:3001/health
   
   # Access web frontend in browser
   open http://localhost
   ```

4. **View logs:**

   ```bash
   # All services
   docker compose logs -f
   
   # Server only
   docker compose logs -f server
   
   # Web only
   docker compose logs -f web
   ```

5. **Stop services:**

   ```bash
   # Stop containers (preserves database)
   docker compose down
   
   # Stop and remove volumes (⚠️ deletes database)
   docker compose down -v
   ```

## Database

- **SQLite** database persists in Docker volume `flourish-db` (mounted at `/app/data/db/flourish.db` in the server container)
- **Migrations** run automatically on server startup
- **Backup the database:**

  ```bash
  docker compose exec server sqlite3 /app/data/db/flourish.db ".backup /tmp/backup.db"
  docker compose cp server:/tmp/backup.db ./backup-$(date +%Y%m%d).db
  ```

- **Restore from backup:**

  ```bash
  docker compose down
  docker volume rm flourish-db
  docker volume create flourish-db
  docker compose up -d server
  docker compose cp ./backup-20250110.db server:/app/data/db/flourish.db
  docker compose restart server
  ```

## Production Deployment (Public Server)

For production deployment with HTTPS and a custom domain:

### Option A: Traefik Reverse Proxy (Recommended)

1. **Update `docker-compose.yml` to add Traefik labels to the `web` service:**

   ```yaml
   services:
     web:
       # ... existing config ...
       labels:
         - "traefik.enable=true"
         - "traefik.http.routers.flourish.rule=Host(`your-domain.com`)"
         - "traefik.http.routers.flourish.entrypoints=websecure"
         - "traefik.http.routers.flourish.tls.certresolver=letsencrypt"
       networks:
         - default
         - traefik
   ```

2. **Update `.env`:**

   ```bash
   CORS_ORIGIN=https://your-domain.com
   JWT_SECRET=your-production-secret
   ```

3. **Deploy:**

   ```bash
   docker compose up -d --build
   ```

### Option B: Nginx Reverse Proxy

1. **Add an Nginx config on the host machine** (`/etc/nginx/sites-available/flourish`):

   ```nginx
   server {
       listen 443 ssl http2;
       server_name your-domain.com;

       ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

       location / {
           proxy_pass http://localhost:80;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }

   server {
       listen 80;
       server_name your-domain.com;
       return 301 https://$host$request_uri;
   }
   ```

2. **Enable the site:**

   ```bash
   sudo ln -s /etc/nginx/sites-available/flourish /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. **Update `.env` and deploy:**

   ```bash
   CORS_ORIGIN=https://your-domain.com
   ```

   ```bash
   docker compose up -d --build
   ```

## Environment Variables

### Server (Required)

- `NODE_ENV`: `production` (set automatically by Docker)
- `PORT`: Internal container port (default: `3000`, exposed as `3001` on host)
- `DATABASE_PATH`: Path to SQLite database (default: `/app/data/db/flourish.db`)
- `JWT_SECRET`: **Required in production**. Secret key for JWT tokens (min 32 chars recommended)
- `CORS_ORIGIN`: Allowed frontend origin (default: `http://localhost`)

### Web (Optional)

- API base URL is configured via Nginx reverse proxy in the container (see `apps/web/nginx.conf`)

## Monitoring

### Health Checks

- Server health endpoint: `http://localhost:3001/health`
- Docker health status: `docker compose ps` shows `healthy` when the server is ready

### Logs

- Structured JSON logging for production (grep-friendly):

  ```bash
  docker compose logs server | grep '"level":"error"'
  docker compose logs server | jq '. | select(.level == "error")'
  ```

## Architecture

```
┌─────────────────┐
│  Client Browser │
└────────┬────────┘
         │ http://localhost (port 80)
         ▼
┌─────────────────────────────┐
│  flourish-web               │
│  (nginx serving React SPA)  │
│  - Static assets            │
│  - /api/* → proxy to server │
└────────┬────────────────────┘
         │ internal docker network
         ▼
┌─────────────────────────────┐
│  flourish-server            │
│  (Node.js Express API)      │
│  - REST endpoints           │
│  - SQLite database          │
│  - Exercise library         │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  flourish-db volume         │
│  (persistent SQLite DB)     │
└─────────────────────────────┘
```

## Security Checklist

- [ ] Use a strong random `JWT_SECRET` (32+ characters)
- [ ] Set `CORS_ORIGIN` to your actual frontend domain (not `*`)
- [ ] Enable HTTPS with Let's Encrypt or Cloudflare in production
- [ ] Restrict Docker port exposure (`3001:3000` is only needed for direct API access; remove if using reverse proxy)
- [ ] Regularly backup the `flourish-db` volume
- [ ] Keep Docker images updated: `docker compose pull && docker compose up -d`

## Troubleshooting

### Server crashes on startup with "JWT_SECRET must be configured"

**Cause:** `JWT_SECRET` not set in `.env` or environment.  
**Fix:** Add `JWT_SECRET=your-secret` to `.env` file at repo root.

### "Cannot locate repo root (pnpm-workspace.yaml not found)"

**Cause:** Docker build context is wrong or `pnpm-workspace.yaml` not copied.  
**Fix:** Run `docker compose build` from the **repo root**, not from `apps/server`.

### better-sqlite3 error (MODULE_NOT_FOUND or native binding)

**Cause:** Native bindings not compiled for Alpine Linux in Docker.  
**Fix:** Rebuild with `docker compose build --no-cache` to recompile `better-sqlite3`.

### Web can't reach API (404 on /api/plans/today)

**Cause:** Nginx proxy misconfiguration or server not healthy.  
**Fix:**
1. Check `docker compose ps` — server should show `healthy`
2. Check `docker compose logs web` for nginx errors
3. Verify `apps/web/nginx.conf` proxies `/api/` to `http://server:3000/api/`

### Database lost after `docker compose down`

**Cause:** Volumes removed with `-v` flag.  
**Fix:** Never use `docker compose down -v` unless you intend to delete all data. Use `docker compose down` (without `-v`) to preserve volumes.

## CI/CD Integration

Example GitHub Actions workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push images
        run: |
          docker compose build
          docker compose push
      
      - name: Deploy to server via SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/flourish
            docker compose pull
            docker compose up -d
```

## Performance Tuning

- **Database**: SQLite is sufficient for single-server deployments (<10k users). For multi-region or high concurrency, consider PostgreSQL.
- **Static assets**: Add CDN caching for `/assets/*` (Cloudflare, Fastly, etc.)
- **Horizontal scaling**: The current architecture uses a single SQLite database file, limiting scaling to vertical (larger VM). For horizontal scaling, migrate to PostgreSQL and add a load balancer.

## License

See root [LICENSE](LICENSE) file.
