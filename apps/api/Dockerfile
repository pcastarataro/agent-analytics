FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/event-schema/package.json ./packages/event-schema/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY apps/api ./apps/api
COPY packages/database ./packages/database
COPY packages/event-schema ./packages/event-schema
COPY packages/shared ./packages/shared
COPY tsconfig.json tsconfig.base.json ./

EXPOSE 3000

CMD ["npx", "tsx", "apps/api/src/index.ts"]
