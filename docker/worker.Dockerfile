# Worker (async job consumer). Ships the REAL recorder: FFmpeg for encoding plus
# Playwright Chromium and its system libraries so the prototype-recorder-cli
# engine can launch a browser in-container (EXECUTOR=local-process + ENGINE_DIR).
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY packages ./packages
COPY apps ./apps
# Skip the engine postinstall's best-effort (deps-less) Chromium download — we
# install the browser AND its OS libraries explicitly below with --with-deps.
RUN PROTOTYPE_RECORDER_CLI_SKIP_BROWSER=1 npm ci
RUN npm run db:generate -w @ptw/core
# Chromium + required shared libraries (libnss3, libatk, …). Needs root (build stage).
RUN npx playwright install --with-deps chromium
ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "@ptw/worker"]
