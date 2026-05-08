# 1. Use the lightweight Node image
FROM node:22-alpine

# 2. Set the working directory
WORKDIR /app

# 3. Install ALL dependencies (including dev tools for TypeScript)
COPY package*.json ./
RUN npm install

# 4. Copy your actual code
COPY . .

# 5. Generate Prisma with the strict version lock to prevent the V7 crash
RUN npx prisma@6.19.3 generate

# 6. Build the TypeScript into JavaScript
RUN npm run build

# 7. Open the port for DigitalOcean
EXPOSE 5000

# 8. Start the server instantly (No migrations, no npm wrappers)
CMD ["node", "dist/src/server.js"]