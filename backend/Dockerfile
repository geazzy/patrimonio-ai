# Backend Dockerfile
# Build TypeScript -> dist, keep native deps (better-sqlite3)

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Stage 1: deps (inclui dev para build)
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

# Stage 2: build
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 3: runtime
FROM base AS runtime
RUN apk add --no-cache libstdc++
WORKDIR /app
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
