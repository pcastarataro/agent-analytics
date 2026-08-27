FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/event-schema/package.json packages/event-schema/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/opencode-collector/package.json packages/opencode-collector/

RUN npm ci
RUN npm install tsx

COPY apps/api/ apps/api/
COPY packages/event-schema/ packages/event-schema/
COPY packages/database/ packages/database/
COPY packages/shared/ packages/shared/
COPY packages/opencode-collector/ packages/opencode-collector/
COPY tsconfig.base.json tsconfig.json ./

FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /app .

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "apps/api/src/main.ts"]
