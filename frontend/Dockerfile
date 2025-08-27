# Frontend Dockerfile
FROM node:20-alpine

WORKDIR /app/frontend

COPY frontend/package.json frontend/yarn.lock* ./
RUN yarn install --frozen-lockfile || yarn install

COPY frontend /app/frontend

EXPOSE 3000
CMD ["yarn", "start"]
