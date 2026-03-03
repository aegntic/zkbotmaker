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

3. **Start with HTTPS profile:**
   ```bash
   docker compose --profile https up -d
   ```

## Requirements

- Your domain must be publicly accessible on ports 80 and 443
- DNS A/AAAA records must point to this server
- Caddy will automatically obtain and renew Let's Encrypt certificates

## Without HTTPS

By default, BotMaker runs on HTTP port 7100 without the Caddy proxy:

```bash
docker compose up -d
```

Access at `http://localhost:7100` or `http://your-server-ip:7100`
