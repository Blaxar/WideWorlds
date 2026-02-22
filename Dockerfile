FROM alpine:latest

ENV WW_SERVER_NAME=localhost
ENV WW_SERVER_DATA_FOLDER=/data
ENV WW_SERVER_WORLD_FOLDER=${WW_SERVER_DATA_FOLDER}/worlds
ENV WW_SERVER_CA_FOLDER=${WW_SERVER_DATA_FOLDER}/nginx
ENV WW_SERVER_CERTIFICATE=${WW_SERVER_CA_FOLDER}/ww.crt
ENV WW_SERVER_CERTIFICATE_KEY=${WW_SERVER_CA_FOLDER}/ww.key
ENV WW_SERVER_NGINX_CONF=/etc/nginx/http.d/wideworlds.conf

RUN apk update && apk upgrade
RUN apk add nginx npm openssl

# Set NGINX configuration to server WideWorlds over HTTPS and WSS
COPY deployment/wideworlds.conf "${WW_SERVER_NGINX_CONF}"
COPY deployment/entrypoint.sh /root/entrypoint.sh
RUN chmod u+x /root/entrypoint.sh

COPY package.json /root/package.json
COPY common /root/common
COPY client /root/client
COPY server /root/server
WORKDIR /root

RUN npm i
RUN npm run client-build
RUN mkdir /var/www/wideworlds && cp -r /root/client/dist /var/www/wideworlds/ && chown root:www-data -R /var/www/wideworlds
ENTRYPOINT ["/root/entrypoint.sh"]