#!/usr/bin/env bash
# Deploy from your laptop to a VPS (for private GitHub repos).
#
# Usage:
#   bash scripts/vps-deploy-from-local.sh root@YOUR_VPS_IP \
#     --domain app.frodotyping.com
#
# First deploy: installs Node, PM2, Playwright, Caddy, builds, starts PM2.
# Re-deploy:   rsync + rebuild + pm2 restart (pass --update-only).
#
set -euo pipefail

SSH_TARGET=""
DOMAIN=""
APP_DIR="/opt/ptw"
UPDATE_ONLY=false

usage() {
  sed -n '2,6p' "$0"
  echo "Options:"
  echo "  --domain DOMAIN       Hostname for Caddy HTTPS (optional on first run)"
  echo "  --app-dir PATH        Remote install dir (default: /opt/ptw)"
  echo "  --update-only         Skip apt/Caddy setup; rsync + build + restart only"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --app-dir) APP_DIR="$2"; shift 2 ;;
    --update-only) UPDATE_ONLY=true; shift ;;
    -h|--help) usage; exit 0 ;;
    -*)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
    *)
      if [[ -z "$SSH_TARGET" ]]; then
        SSH_TARGET="$1"
      else
        echo "Unexpected argument: $1"
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$SSH_TARGET" ]]; then
  echo "ERROR: SSH target required (e.g. root@203.0.113.10)"
  usage
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REVISION="$(git -C "$ROOT" rev-parse HEAD)"
BRANCH="$(git -C "$ROOT" branch --show-current)"
REMOTE_URL="$(git -C "$ROOT" remote get-url origin)"

if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: deploys must come from canonical main (current: $BRANCH)"
  exit 1
fi

if [[ "$REMOTE_URL" != "https://github.com/jschmittler/prototype-recorder.git" &&
      "$REMOTE_URL" != "git@github.com:jschmittler/prototype-recorder.git" ]]; then
  echo "ERROR: origin is not the canonical repository: $REMOTE_URL"
  exit 1
fi

if [[ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]]; then
  echo "ERROR: tracked files are modified; commit or restore them before deploying"
  exit 1
fi

echo "==> Syncing $ROOT -> $SSH_TARGET:$APP_DIR"
echo "==> Canonical version: $REVISION"

ssh "$SSH_TARGET" "mkdir -p '$APP_DIR'"

# --delete removes anything on the server that is not here, so every server-owned
# path must be excluded explicitly. Excluded paths are also protected from
# deletion by rsync, which is what keeps the production env files alive.
# "/.env" is anchored to the transfer root: that file holds the production
# secrets and is created on the server, never in the repo.
rsync -avz --delete \
  --exclude node_modules \
  --exclude apps/web/.next \
  --exclude apps/web/node_modules \
  --exclude hostinger-dist \
  --exclude storage \
  --exclude .git \
  --exclude /.deploy-version \
  --exclude /.env \
  --exclude apps/web/.env \
  "$ROOT/" "$SSH_TARGET:$APP_DIR/"

ssh "$SSH_TARGET" "printf '%s\\n' '$REVISION' > '$APP_DIR/.deploy-version'"

SETUP_ARGS=(--app-dir "$APP_DIR" --skip-clone)
if [[ -n "$DOMAIN" ]]; then
  SETUP_ARGS+=(--domain "$DOMAIN")
fi
if [[ "$UPDATE_ONLY" == true ]]; then
  SETUP_ARGS+=(--skip-apt)
fi

echo "==> Running remote setup on $SSH_TARGET"
ssh -t "$SSH_TARGET" "cd '$APP_DIR' && bash scripts/vps-setup.sh ${SETUP_ARGS[*]}"

echo ""
echo "Done. Health check:"
ssh "$SSH_TARGET" "curl -s http://127.0.0.1:3000/api/health || true"
echo ""
if [[ -n "$DOMAIN" ]]; then
  echo "Visit: https://$DOMAIN"
fi
