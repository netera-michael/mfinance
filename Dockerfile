# ─── Stage 1: Build Vite frontend ───────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# All dependencies (frontend + server) are in root package.json
COPY package*.json ./
RUN npm install

# Copy all source and build the Vite frontend
COPY . .
RUN npm run build


# ─── Stage 2: Production image ──────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies from root package.json
COPY package*.json ./
RUN npm install --omit=dev

# Copy built Vite frontend
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server/ ./server/

# Copy nginx + supervisor configs
COPY nginx.conf /etc/nginx/nginx.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Install nginx + supervisor
RUN apk add --no-cache nginx supervisor && \
    mkdir -p /var/log/supervisor

# Data directory for persistent JSON files (budgets, forecasts)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 80

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
