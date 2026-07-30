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
| **Start command** | `node server.js` |
| **Output directory** | `hostinger-dist` |
| **Entry file** | `server.js` |
| **Package manager** | npm |

Use **`node server.js`** for Start command (not `npm run start`). At runtime
Hostinger’s working directory is the output folder, which already contains
`server.js`.

Do **not** use `npm run build:vps` or `npm run build:web` alone — those skip the
`hostinger-dist` bundle.

## Environment variables (demo)

**Replace your current env vars with these** for the shared-hosting demo:

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

Remove `EXECUTOR=local-process` and `ANTHROPIC_API_KEY` unless you move to a VPS.
`local-process` requires Playwright, which shared hosting cannot run.

## After deploy

1. Build log must end with: `[hostinger] deploy bundle ready at .../hostinger-dist/server.js`
2. Open **Runtime logs** — you should see `Next.js` starting.
3. Visit `/api/health` — expect `"executor":"fake"` and `"ok":true`.
4. Click **Running → Restart** if you still see 503 from the CDN.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build succeeds but deploy fails / 503 | Ensure `hostinger-dist/` is **not** in `.gitignore` (fixed in repo) |
| `Cannot find module .../server.js` | Output = `hostinger-dist`, entry = `server.js`, start = `node server.js` |
| Build: `standalone server missing` | Build command must be `npm run build` |
| Jobs fail at PREPARING | Set `EXECUTOR=fake` (not `local-process`) |

## Redeploy checklist

```bash
git push origin main   # prototype-recorder-live
# hPanel → Deployments → Redeploy
# hPanel → Running → Restart
```
