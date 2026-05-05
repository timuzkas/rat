FROM node:18-alpine

WORKDIR /app

# Copy server script and all game files into the container
COPY server.js ./
COPY index.html ./
COPY rat-boxing.html ./
# Include assets if they are in the root directory
COPY *.obj *.png ./

EXPOSE 3000

# Start the Node.js server
CMD ["node", "server.js"]
