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

# Copy custom configuration
COPY httpd.conf /usr/local/apache2/conf/httpd.conf

# Copy entrypoint to generate SSL certs at runtime if missing
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose ports
EXPOSE 80 443

# Start Apache
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["httpd", "-D", "FOREGROUND"]
