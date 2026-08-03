#!/usr/bin/env bash
# Prototype Walkthrough — single VPS bootstrap (Ubuntu 22.04/24.04).
#
# Usage (on a fresh VPS as root or sudo user):
#   curl -fsSL https://raw.githubusercontent.com/jschmittler/prototype-recorder/main/scripts/vps-setup.sh | bash -s -- \
#     --domain frodotyping.com \
#     --app-dir /opt/ptw
#
# Or clone first, then:
#   sudo bash scripts/vps-setup.sh --domain frodotyping.com
#
set -euo pipefail

DOMAIN=""
APP_DIR="/opt/ptw"
REPO="https://github.com/jschmittler/prototype-recorder.git"
BRANCH="main"
SKIP_APT=false
SKIP_CLONE=false

usage() {
  sed -n '2,8p' "$0"
  echo "Options:"
  echo "  --domain DOMAIN     Public hostname (enables Caddy HTTPS). Optional."
  echo "  --app-dir PATH      Install directory (default: /opt/ptw)"
  echo "  --repo URL          Git remote (default: prototype-recorder)"
  echo "  --branch NAME       Git branch (default: main)"
  echo "  --skip-apt          Skip apt packages (Node/Caddy already installed)"
  echo "  --skip-clone        Skip git clone/pull (app already rsync'd to --app-dir)"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --app-dir) APP_DIR="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --skip-apt) SKIP_APT=true; shift ;;
    --skip-clone) SKIP_CLONE=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

if [[ "$APP_DIR" != /* ]]; then
  echo "ERROR: --app-dir must be an absolute path."
  exit 1
fi

if [[ -n "$DOMAIN" ]] && [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9.-]+$ ]]; then
  echo "ERROR: invalid --domain"
  exit 1
fi

if [[ "$SKIP_APT" == false ]]; then
  echo "==> Installing system packages..."
  sudo apt-get update -qq
  sudo apt-get install -y curl git ffmpeg ca-certificates gnupg
  if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  if ! command -v pm2 >/dev/null; then
    sudo npm install -g pm2
  fi
  if [[ -n "$DOMAIN" ]] && ! command -v caddy >/dev/null; then
    sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt-get update -qq
    sudo apt-get install -y caddy
  fi
fi

echo "==> Preparing app directory: $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER:$USER" "$APP_DIR"

if [[ "$SKIP_CLONE" == false ]]; then
  if [[ ! -d "$APP_DIR/.git" ]]; then
    git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
  else
    git -C "$APP_DIR" fetch origin "$BRANCH"
    git -C "$APP_DIR" checkout "$BRANCH"
    git -C "$APP_DIR" pull origin "$BRANCH"
  fi
elif [[ ! -d "$APP_DIR" ]]; then
  echo "ERROR: --skip-clone set but $APP_DIR does not exist. Rsync the repo first."
  exit 1
fi

cd "$APP_DIR"

if [[ -d .git ]]; then
  git rev-parse HEAD > .deploy-version
fi

if [[ ! -f .env ]]; then
  cp .env.vps.example .env
  sed -i "s|ENGINE_DIR=.*|ENGINE_DIR=$APP_DIR/packages/recorder-cli|" .env
  sed -i "s|STORAGE_DIR=.*|STORAGE_DIR=$APP_DIR/storage|" .env
  echo ""
  echo "!! Created $APP_DIR/.env — edit ANTHROPIC_API_KEY before going live !!"
  echo ""
fi

mkdir -p storage

echo "==> Installing npm dependencies..."
export PROTOTYPE_RECORDER_CLI_SKIP_BROWSER=1
npm ci

echo "==> Installing Playwright Chromium (recording engine)..."
cd packages/recorder-cli
npx playwright install --with-deps chromium
cd "$APP_DIR"

echo "==> Building web app..."
npm run build:vps

echo "==> Starting with PM2..."
pm2 delete ptw 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true

if [[ -n "$DOMAIN" ]]; then
  CADDYFILE="/etc/caddy/Caddyfile"
  BLOCK="
$DOMAIN {
  reverse_proxy 127.0.0.1:3000
}
"
  if sudo grep -q "$DOMAIN" "$CADDYFILE" 2>/dev/null; then
    echo "==> Caddy already configured for $DOMAIN"
  else
    echo "==> Configuring Caddy for https://$DOMAIN"
    echo "$BLOCK" | sudo tee -a "$CADDYFILE" >/dev/null
    sudo systemctl reload caddy
  fi
  echo ""
  echo "Point DNS A record: $DOMAIN -> $(curl -4 -s ifconfig.me 2>/dev/null || echo 'YOUR_VPS_IP')"
fi

echo ""
echo "============================================"
echo " VPS setup complete"
echo " App dir : $APP_DIR"
echo " Health  : curl http://127.0.0.1:3000/api/health"
echo " Logs    : pm2 logs ptw"
echo " Restart : pm2 restart ptw"
echo ""
echo " Next steps:"
echo "  1. Edit $APP_DIR/.env — set ANTHROPIC_API_KEY"
echo "  2. pm2 restart ptw"
if [[ -n "$DOMAIN" ]]; then
  echo "  3. Visit https://$DOMAIN"
else
  echo "  3. Open http://YOUR_VPS_IP:3000 (or re-run with --domain)"
fi
echo "============================================"
