FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

RUN npx prisma generate && npm run build

EXPOSE 5000

CMD ["npm", "run", "start"]
