FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

LABEL org.opencontainers.image.source="https://github.com/Somesh-Debnath/pcms_frontend/tree/master/pcms-frontend"
LABEL org.opencontainers.image.description="PCMS Frontend Application"
LABEL org.opencontainers.image.licenses=MIT

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]