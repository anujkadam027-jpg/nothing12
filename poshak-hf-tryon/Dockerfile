FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production

RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
