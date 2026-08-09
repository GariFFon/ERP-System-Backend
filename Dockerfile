FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma/
COPY src ./src/
COPY tsconfig.json ./

RUN npm install typescript ts-node -g
RUN npx prisma generate
RUN npx tsc

EXPOSE 4000

CMD ["node", "dist/index.js"]
