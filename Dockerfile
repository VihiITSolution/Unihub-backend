# Backend Dockerfile for Unihub LMS
# Simple Node.js backend container

# Use official Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose backend port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Create startup script that runs migrations then starts app
RUN echo '#!/bin/sh\nset -e\necho "Running database migrations..."\nnode src/migrations/migrate.js\necho "Starting application..."\nnode src/server.js' > /app/start.sh && \
    chmod +x /app/start.sh

# Start the application with migrations
CMD ["/app/start.sh"]
