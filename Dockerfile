FROM node:18-alpine

WORKDIR /app

# Copy package files first for better Cashing
COPY package*.json ./
RUN npm ci --only=production

# Copy App Source
COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "app.js"]
