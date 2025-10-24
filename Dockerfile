FROM node:lts
WORKDIR /app

COPY wrangler.dockers.jsonc wrangler.jsonc
COPY entrypoint.sh ./entrypoint.sh
COPY public ./public
COPY package*.json ./
COPY schema.set.sql ./
COPY src ./src

RUN npm install -g wrangler
RUN chmod +x ./entrypoint.sh
RUN npm install
RUN apt update && apt install -y cron
COPY src/http.js ./node_modules/acme-client/src/
RUN wrangler d1 execute test-db --local --file schema.set.sql
RUN echo "*/1 * * * * root curl 127.0.0.1:3000/tasks/" >> /etc/crontab
EXPOSE 3000
ENTRYPOINT ["sh","/app/entrypoint.sh"]