FROM node:22-alpine AS base
WORKDIR /app

# bcrypt native module needs build tools on Alpine
RUN apk add --no-cache python3 make g++

FROM base AS deps
COPY package*.json ./
# Skip husky prepare script (monorepo-only); prisma generate runs in build stage
ENV HUSKY=0
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HUSKY=0
# Render sets PORT at runtime (often 10000); don't hard-require 3000
ENV PORT=3000

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

# Healthcheck uses $PORT so it works on Render (10000) and local (3000)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000; fetch('http://127.0.0.1:'+p+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
