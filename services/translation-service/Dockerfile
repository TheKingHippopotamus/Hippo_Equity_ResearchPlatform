FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for TypeScript)
RUN npm install

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Copy locale files to dist (they are not compiled by TypeScript)
# The path in the code is relative to dist/src/services, so locales should be at dist/src/locales
RUN if [ -d "src/locales" ]; then mkdir -p dist/src/locales && cp -r src/locales/*.json dist/src/locales/; fi

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3004/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/index.js"]

