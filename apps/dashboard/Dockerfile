FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/event-schema/package.json packages/event-schema/

RUN npm ci

COPY apps/dashboard/ apps/dashboard/
COPY packages/event-schema/ packages/event-schema/
COPY tsconfig.base.json tsconfig.json ./

RUN npm run build -w apps/dashboard

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/dashboard/dist /usr/share/nginx/html
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
