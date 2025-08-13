# Use Node.js 20 as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Push database schema (will be skipped if DATABASE_URL not available)
RUN npm run db:push || echo "Database push skipped - no DATABASE_URL"

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]