FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY backend/package*.json backend/
RUN npm install

COPY backend backend
RUN npm run prisma:generate --workspace backend
RUN npm run build --workspace backend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY backend/package*.json backend/
RUN npm install --omit=dev

COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma

EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "backend"]
