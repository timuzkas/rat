FROM node:18-alpine

WORKDIR /app

# Copy everything from the directory into the container
COPY . .

EXPOSE 3000

# Start the Node.js server
CMD ["node", "server.js"]
