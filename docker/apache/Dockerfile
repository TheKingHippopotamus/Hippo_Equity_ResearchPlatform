FROM httpd:2.4-alpine

# Install required modules
RUN apk add --no-cache \
    openssl

# Enable required modules
RUN sed -i \
    -e 's/^#\(LoadModule rewrite_module\)/\1/' \
    -e 's/^#\(LoadModule proxy_module\)/\1/' \
    -e 's/^#\(LoadModule proxy_http_module\)/\1/' \
    -e 's/^#\(LoadModule headers_module\)/\1/' \
    -e 's/^#\(LoadModule deflate_module\)/\1/' \
    -e 's/^#\(LoadModule ssl_module\)/\1/' \
    /usr/local/apache2/conf/httpd.conf

# Create SSL directory
RUN mkdir -p /usr/local/apache2/conf/ssl

# Generate self-signed certificate for development (replace with real certs in production)
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /usr/local/apache2/conf/ssl/server.key \
    -out /usr/local/apache2/conf/ssl/server.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Copy custom configuration
COPY httpd.conf /usr/local/apache2/conf/httpd.conf

# Expose ports
EXPOSE 80 443

# Start Apache
CMD ["httpd", "-D", "FOREGROUND"]

