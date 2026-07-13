FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm i prisma --no-save 2>/dev/null || npm install --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p uploads backups
EXPOSE 5000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && node src/index.js"]
