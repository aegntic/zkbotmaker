# HTTPS Configuration

BotMaker can optionally run behind a Caddy reverse proxy for automatic HTTPS with Let's Encrypt certificates.

## Setup

1. **Copy the example Caddyfile:**
   ```bash
   cp Caddyfile.example Caddyfile
   ```

2. **Edit Caddyfile with your domain:**
   ```
   yourdomain.com {
       reverse_proxy botmaker:7100
   }
   ```

3. **Set required environment variables** (e.g., in `.env`):
   ```bash
   PUBLIC_HOST=yourdomain.com
   CADDY_ENABLED=true
   ```
   Without these, BotMaker will bind bot ports directly instead of routing through Caddy, and per-bot HTTPS routes won't be registered.

4. **Start with HTTPS profile:**
   ```bash
   docker compose --profile https up -d
   ```

## Requirements

- Your domain must be publicly accessible on ports 80 and 443
- Bot Control UI ports (19000+) must also be reachable from clients for `https://PUBLIC_HOST:<botPort>` access
- DNS A/AAAA records must point to this server
- Caddy will automatically obtain and renew Let's Encrypt certificates

## Without HTTPS

By default, BotMaker runs on HTTP port 7100 without the Caddy proxy:

```bash
docker compose up -d
```

Access at `http://localhost:7100` or `http://your-server-ip:7100`
