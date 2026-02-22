#!/bin/sh

ERR_C='\033[0;31m'
WRN_C='\033[0;33m'
INF_C='\033[0;32m'
NO_C='\033[0m'

mkdir -p ${WW_SERVER_CA_FOLDER} ${WW_SERVER_WORLD_FOLDER}

sed "s/__SERVER_NAME__/${WW_SERVER_NAME}/g" -i ${WW_SERVER_NGINX_CONF}
sed "s/__SERVER_CERTIFICATE__/${WW_SERVER_CERTIFICATE//\//\\/}/g" -i ${WW_SERVER_NGINX_CONF}
sed "s/__SERVER_CERTIFICATE_KEY__/${WW_SERVER_CERTIFICATE_KEY//\//\\/}/g" -i ${WW_SERVER_NGINX_CONF}

if [ -f "${WW_SERVER_CERTIFICATE}" ] && [ ! -f "${WW_SERVER_CERTIFICATE_KEY}" ]; then
    printf "${ERR_C}Found '${WW_SERVER_CERTIFICATE}', but missing private key under '${WW_SERVER_CERTIFICATE_KEY}'...${NO_C}\n" >&2
    printf "${ERR_C}Add the macthing private key, or clear '${WW_SERVER_CA_FOLDER}' to generate a self-signed certificate.${NO_C}\n" >&2
    exit 1
fi

if [ ! -f "${WW_SERVER_CERTIFICATE_KEY}" ]; then \
    openssl genrsa -out "${WW_SERVER_CERTIFICATE_KEY}" 2048
    printf "${WRN_C}Created private key to sign HTTPS certifcate...${NO_C}\n"
    printf "${WRN_C}To use an existing one: mount the '${WW_SERVER_DATA_FOLDER}' folder and copy it under '${WW_SERVER_CERTIFICATE_KEY}'.${NO_C}\n"
fi

if [ ! -f "${WW_SERVER_CERTIFICATE}" ]; then
    openssl req -x509 -nodes -days 365 -key "${WW_SERVER_CERTIFICATE_KEY}" -out "${WW_SERVER_CERTIFICATE}" \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=commonname"
    printf "${WRN_C}Created certificate signed with '${WW_SERVER_CERTIFICATE_KEY}' to serve HTTPS...${NO_C}\n"
    printf "${WRN_C}To use an existing one: mount the '${WW_SERVER_DATA_FOLDER}' folder and copy it under '${WW_SERVER_CERTIFICATE}'.${NO_C}\n"
fi

printf "\n${INF_C}Nginx server will listen on port 443 to serve HTTPS and WSS, visit https://${WW_SERVER_NAME}${NO_C}\n"

nginx && npm run server -- --db ${WW_SERVER_DATA_FOLDER}/db.sqlite3 --worldFolder ${WW_SERVER_WORLD_FOLDER} | npx pino-pretty
