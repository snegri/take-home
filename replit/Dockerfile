FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

RUN mkdir -p /app/data

EXPOSE 8000

CMD ["node", "dist/index.js"]
