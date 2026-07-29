# Web (Next.js UI + API/BFF)
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci
RUN npm run db:generate -w @ptw/core
RUN npm run build:web
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "prototype-recorder-web"]
