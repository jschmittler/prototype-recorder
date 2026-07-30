# Hostinger shared Node.js (demo site)

Deploy the **demo** app on Hostinger’s Node.js product. Real Playwright recording
requires a VPS — see [vps-deploy.md](./vps-deploy.md).

## hPanel settings

| Setting | Value |
| --- | --- |
| **Framework** | Next.js (or Other) |
| **Branch** | `main` |
| **Node version** | **20.x** |
| **Root directory** | `./` |
| **Build command** | `npm run build` |
| **Start command** | `npm run start` |
| **Output directory** | `hostinger-dist` |
| **Entry file** | `server.js` |
| **Package manager** | npm |

Do **not** use `npm run build:vps` or `npm run build:web` alone — those skip the
`hostinger-dist` bundle.

## Environment variables (demo)

```
APP_MODE=demo
EXECUTOR=fake
AI_PROVIDER=fake
JOB_STORE=memory
QUEUE_DRIVER=memory
STORAGE_DRIVER=local
NODE_ENV=production
```

Remove `EXECUTOR=local-process` if present — it cannot run on shared hosting.

## After deploy

1. Open **Runtime logs** — you should see `Next.js` starting and **no** errors.
2. Visit `/api/health` — expect `"executor":"fake"` and `"ok":true`.
3. Click **Running → Restart** if you still see 503 from the CDN.

## Troubleshooting 503

| Symptom | Fix |
| --- | --- |
| Build log: `standalone server missing` | Build command must be `npm run build` (not `build:web`) |
| `Cannot find module .../server.js` | Output directory must be `hostinger-dist`, entry `server.js` |
| App starts then 503 | Restart from hPanel; confirm output directory is `hostinger-dist` |
| Security scan blocks deploy | Run `npm audit` locally; fix before push |

## Redeploy checklist

```bash
git push origin main   # prototype-recorder-live
# hPanel → Deployments → Redeploy
# hPanel → Running → Restart
```
