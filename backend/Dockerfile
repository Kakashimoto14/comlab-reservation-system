FROM node:22-alpine

WORKDIR /app

# Prisma runs during postinstall, so copy the schema before npm install.
COPY package*.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

RUN npm run build

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
