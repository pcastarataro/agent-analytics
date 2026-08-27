FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/event-schema/package.json ./packages/event-schema/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY apps/dashboard ./apps/dashboard
COPY packages/event-schema ./packages/event-schema
COPY packages/shared ./packages/shared
COPY tsconfig.json tsconfig.base.json ./

# Build dashboard
RUN cd apps/dashboard && npm run build

FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
