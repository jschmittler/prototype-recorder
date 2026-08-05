# VPS deployment (single server)

Run the **full product** on one Linux VPS: real Figma inspection, AI script
generation, Playwright recording, and video download — no Docker, no separate
worker, no Postgres/Redis required for v1.

**Typical cost:** ~$7–12/month (Hetzner CX32, Hostinger VPS KVM 2, or DigitalOcean 2 GB).

## What you get

| Feature | v1 VPS setup |
| --- | --- |
| Web UI + API | Next.js on port 3000 |
| Background jobs | In-process queue (same server) |
| Real recordings | Playwright + Chromium |
| Job storage | In-memory (restarts clear queue) |
| Artifacts | Local disk (`storage/`) |
| HTTPS | Caddy (automatic Let's Encrypt) |

Upgrade later with Postgres, Redis, and a dedicated worker when you need scale.

## Prerequisites

1. **A VPS** with Ubuntu 22.04 or 24.04, **4 GB RAM** recommended (2 GB minimum, one recording at a time).
2. **A domain** (e.g. `frodotyping.com`) — optional but recommended for HTTPS.
3. **OpenAI API key** for script generation (`AI_PROVIDER=openai`).

## Quick setup (~30 minutes)

### 1. Create the VPS

| Provider | Suggested plan |
| --- | --- |
| [Hetzner Cloud](https://www.hetzner.com/cloud) | CX32 (4 GB) ~€6.80/mo |
| [Hostinger VPS](https://www.hostinger.com/vps-hosting) | KVM 2 (4 GB) |
| [DigitalOcean](https://www.digitalocean.com) | Basic 2 GB ($12/mo) |

Use Ubuntu 22.04 or 24.04. Note the public IP address.

### 2. Point DNS

In your domain registrar, add an **A record**:

```
frodotyping.com  →  YOUR_VPS_IP
```

Wait a few minutes for propagation before HTTPS setup.

### 3. Run the bootstrap script

The GitHub repo is **private**, so the public `curl | bash` one-liner will not work.
Deploy from your laptop instead (rsync + remote setup):

```bash
# From your dev machine (repo root)
bash scripts/vps-deploy-from-local.sh root@YOUR_VPS_IP \
  --domain app.frodotyping.com
```

Or SSH into the VPS and clone with a **deploy key** / personal access token:

```bash
ssh root@YOUR_VPS_IP
git clone git@github.com:jschmittler/prototype-recorder.git /opt/ptw
cd /opt/ptw
sudo bash scripts/vps-setup.sh --domain frodotyping.com --app-dir /opt/ptw
```

**DNS recommendation:** point a subdomain first (`app.frodotyping.com` → VPS IP),
verify recording works, then cut `frodotyping.com` over from Hostinger.

```bash
curl -fsSL https://raw.githubusercontent.com/jschmittler/prototype-recorder/main/scripts/vps-setup.sh | bash -s -- \
  --domain frodotyping.com \
  --app-dir /opt/ptw
```

*(Only works if the repo is public.)*

The script installs Node 20, FFmpeg, PM2, Playwright Chromium, builds the app,
and starts it. With `--domain`, it also configures Caddy for HTTPS.

### 4. Add your API key

```bash
nano /opt/ptw/.env
```

Set:

```
OPENAI_API_KEY=your-key-here
```

Then restart:

```bash
pm2 restart ptw
```

### 5. Verify

```bash
curl -s http://127.0.0.1:3000/api/health | jq
```

Expected:

```json
{
  "ok": true,
  "executor": "local-process",
  "aiProvider": "openai",
  "openaiConfigured": true
}
```

Open `https://frodotyping.com`, submit a Figma prototype URL, and wait for the
walkthrough video.

## Manual commands

| Task | Command |
| --- | --- |
| View logs | `pm2 logs ptw` |
| Restart | `pm2 restart ptw` |
| Update app | `cd /opt/ptw && git pull && npm ci && npm run build:vps && pm2 restart ptw` |
| Reinstall browser | `cd /opt/ptw/packages/recorder-cli && npx playwright install --with-deps chromium` |

## Environment variables

See [`.env.vps.example`](../.env.vps.example). Key settings:

```
EXECUTOR=local-process
ENGINE_DIR=/opt/ptw/packages/recorder-cli
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-sol
JOB_STORE=memory
QUEUE_DRIVER=memory
STORAGE_DRIVER=local
MAX_CONCURRENT_JOBS=1
```

Use `AI_PROVIDER=fake` to skip OpenAI during testing (scripts will be synthetic).

## Moving from Hostinger shared Node.js

Hostinger’s **shared Node.js** product cannot run Playwright. Keep DNS pointed
at your new VPS instead. You can cancel the Node.js app in hPanel once the VPS
is serving traffic.

## Troubleshooting

**Job fails at PREPARING — engine not found**

```bash
ls /opt/ptw/packages/recorder-cli/bin/prototype-recorder-cli.mjs
# Re-run Playwright install:
cd /opt/ptw/packages/recorder-cli && npx playwright install --with-deps chromium
pm2 restart ptw
```

**Out of memory during recording**

- Upgrade to 4 GB RAM, or keep `MAX_CONCURRENT_JOBS=1`.
- Check: `pm2 monit`

**HTTPS not working**

- Confirm DNS A record points to the VPS IP.
- `sudo systemctl status caddy`
- Ensure ports 80 and 443 are open in the VPS firewall.

## Next steps (when you outgrow v1)

- `JOB_STORE=postgres` + managed Postgres
- `QUEUE_DRIVER=redis` + Redis
- Separate `@ptw/worker` service (see `docker-compose.yml`)
- S3 for artifact storage

The same codebase supports all of these via environment variables — no rewrite needed.
