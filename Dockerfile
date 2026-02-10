# Use Node.js LTS (Long Term Support) alpine image for smaller size
FROM node:20-alpine

# Set environment to production checks
ENV NODE_ENV=production

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy app source
COPY . .

# Create directory for uploads if it doesn't exist and set permissions
RUN mkdir -p public/uploads/documentos && chown -R node:node public/uploads

# Expose the port the app runs on
EXPOSE 3000

# Switch to non-root user for security
USER node

# Start command
CMD [ "npm", "start" ]
