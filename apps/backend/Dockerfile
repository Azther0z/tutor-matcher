FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist

EXPOSE 3001
CMD ["npm", "run", "start"]
