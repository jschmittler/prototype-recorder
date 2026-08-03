# Hostinger shared Node.js (demo site)

Deploy the **demo** app on Hostinger’s Node.js product. Real Playwright recording
requires a VPS — see [vps-deploy.md](./vps-deploy.md).

## hPanel settings

| Setting | Value |
| --- | --- |
| **Framework** | Other |
| **Branch** | `main` |
| **Node version** | **20.x** |
| **Root directory** | `./` |
| **Build command** | `npm run build` |
| **Start command** | `node hostinger-entry.cjs` |
| **Output directory** | `.` |
| **Entry file** | `hostinger-entry.cjs` |
| **Package manager** | npm |

Use **output `.`** (repo root), not `hostinger-dist`. The build creates
`hostinger-dist/` on disk; a tracked root entry (`hostinger-entry.cjs`) loads it.
Using `hostinger-dist` alone as output often deploys an empty folder because build
artifacts are not in git.

Do **not** use `npm run build:vps` or `npm run build:web` alone.

## Environment variables (demo)

```
APP_MODE=demo
EXECUTOR=fake
AI_PROVIDER=fake
JOB_STORE=memory
QUEUE_DRIVER=memory
STORAGE_DRIVER=local
NODE_ENV=production
LOG_LEVEL=info
```

Remove `EXECUTOR=local-process` and `ANTHROPIC_API_KEY`.

## After deploy

1. Build log ends with `[hostinger] bundle files: server.js, .next/BUILD_ID, node_modules/next/package.json, .hostinger-deploy`
2. Runtime logs show `Next.js` starting
3. `/api/health` returns `"ok":true`
4. **Running → Restart** if CDN still shows 503

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build OK, site 503 | Output = `.`, entry = `hostinger-entry.cjs`, start = `node hostinger-entry.cjs` |
| `Missing hostinger-dist/server.js` | Build command must be `npm run build` |
| Jobs fail at PREPARING | `EXECUTOR=fake` |

## Redeploy checklist

```bash
git push origin main   # prototype-recorder
# hPanel → update settings → Redeploy → Restart
```
