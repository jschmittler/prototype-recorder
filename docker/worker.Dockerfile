# Worker (async job consumer). FFmpeg is present for the fake recorder; for the
# REAL recorder, add the prototype-recorder-cli engine + its Chromium and set
# EXECUTOR=local-process + ENGINE_DIR (see docs/deployment.md).
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci
RUN npm run db:generate -w @ptw/core
ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "@ptw/worker"]
