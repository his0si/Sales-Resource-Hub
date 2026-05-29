# --- 1단계: Vite 프론트엔드 빌드 ---
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# 빈 값이면 프론트엔드가 같은 도메인의 /api 를 호출 (Nginx가 백엔드로 프록시)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- 2단계: Nginx로 정적 파일 서빙 + /api 프록시 ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
