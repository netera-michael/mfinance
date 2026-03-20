# ─── Stage 1: Build Vite frontend ───────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install frontend dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build


# ─── Stage 2: Production image ──────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install only server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev 2>/dev/null || true

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server/ ./server/

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Install nginx + supervisor (to run nginx + node together)
RUN apk add --no-cache nginx supervisor && \
    mkdir -p /var/log/supervisor

# Supervisor config to manage both processes
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Data directory for persistent JSON files
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 80

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
