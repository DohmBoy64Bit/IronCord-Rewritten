# Build Stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for build)
RUN npm install --verbose

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production Stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
# Using 'install' instead of 'ci' because package-lock.json might be missing
RUN npm install --only=production --verbose

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/schema.sql ./dist/db/schema.sql

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "dist/index.js"]
