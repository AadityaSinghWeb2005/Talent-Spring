FROM node:20-bookworm-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 5000
CMD ["sh", "-c", "npm run db:deploy && npm start"]
