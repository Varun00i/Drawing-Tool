FROM node:20-alpine AS base

# ── Build Client ──
FROM base AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ── Build Server ──
FROM base AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npm run build

# ── Production ──
FROM base AS production
WORKDIR /app

# Copy server
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/package.json ./server/

# Copy client build into server's reach
COPY --from=client-build /app/client/dist ./client/dist

# Create directories for uploads and generated images
RUN mkdir -p server/uploads server/generated-images/cache server/generated-images/curated

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "dist/index.js"]
