FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_API_BASE=http://localhost:8000
ARG VITE_LOCATIONIQ_API_KEY=
ENV VITE_API_BASE=${VITE_API_BASE} \
    VITE_LOCATIONIQ_API_KEY=${VITE_LOCATIONIQ_API_KEY}

RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
