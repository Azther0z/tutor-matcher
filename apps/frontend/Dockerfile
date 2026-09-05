FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

ARG BACKEND_URL
ENV BACKEND_URL=${BACKEND_URL}

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
