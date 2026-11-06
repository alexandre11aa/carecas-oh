# syntax=docker/dockerfile:1

# Estágio de build: instala tudo, valida, testa e compila.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run check && npm test && npm run build

# Estágio final: só compilados e dependências de produção.
FROM node:22-alpine AS final
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server/server/index.js"]
