#!/bin/sh
set -e

SSL_DIR="/usr/local/apache2/conf/ssl"
CERT_FILE="${SSL_DIR}/server.crt"
KEY_FILE="${SSL_DIR}/server.key"
CERT_SUBJECT="${SSL_CERT_SUBJECT:-/C=US/ST=State/L=City/O=Organization/CN=localhost}"

if [ ! -s "${CERT_FILE}" ] || [ ! -s "${KEY_FILE}" ]; then
    echo "Generating self-signed SSL certificate..."
    mkdir -p "${SSL_DIR}"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${KEY_FILE}" \
        -out "${CERT_FILE}" \
        -subj "${CERT_SUBJECT}"
fi

exec "$@"
