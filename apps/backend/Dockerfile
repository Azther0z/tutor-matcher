FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run gen && npm run build

FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8000

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["sh", "-c", "npm run db:migrate && npm start"]
