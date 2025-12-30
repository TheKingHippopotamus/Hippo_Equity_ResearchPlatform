# Container Error Remediation Documentation

Date: 2025-12-29
Owner: Codex (on request)
Scope: Hippo Equity Research App container failures and unhealthy services

## Objective
Stabilize all containers, eliminate restart loops, and restore healthy status across the stack.

## Initial Symptoms
- hippo-apache: Restarting; Apache config errors (missing modules) and SSL cert errors.
- hippo-report-service: Restarting; runtime entrypoint mismatch (missing index.js).
- hippo-translation-service: Restarting; missing locale files in dist.
- hippo-api-gateway: Unhealthy; middleware error (sanitizeObject undefined), transient Postgres connection errors.

## Root Causes Identified
- Apache config used directives requiring modules that were not loaded, plus missing SSL files.
- API Gateway middleware method was used as a handler without binding, causing `this` to be undefined.
- API Gateway healthcheck used `localhost`, which resolved to IPv6 `::1` in container and failed.
- Apache needed `mod_unixd` and explicit `User/Group` to drop privileges on startup.

## Fixes Applied
### Apache
- Enabled required modules in `docker/apache/httpd.conf`:
  - `mod_log_config`, `mod_filter`, `mod_setenvif`, `mod_ratelimit`, `mod_env`, `mod_unixd`.
- Added runtime user and group:
  - `User daemon`
  - `Group daemon`
- Generated and mounted development SSL certs:
  - `docker/apache/ssl/server.crt`
  - `docker/apache/ssl/server.key`

### API Gateway
- Fixed validator middleware binding:
  - Converted `sanitizeRequestBody` to arrow function to preserve `this` context.
- Updated Docker healthcheck to avoid IPv6 loopback:
  - `http://127.0.0.1:3000/health` with error handling.

### Report Service
- Rebuild ensured proper compiled output and entrypoint used `dist/index.js`.

### Translation Service
- Ensured locale JSON files copied into `dist/src/locales` during image build.

## Commands Executed (high level)
- Rebuilt and restarted affected services:
  - `docker compose -f docker-compose.yml up -d --build apache report-service translation-service api-gateway`
- Regenerated SSL certs:
  - `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout docker/apache/ssl/server.key -out docker/apache/ssl/server.crt ...`

## Current Status
All services are up and healthy:
- hippo-apache: Up (warnings about self-signed cert remain in logs, expected for dev).
- hippo-api-gateway: Healthy.
- hippo-report-service: Healthy.
- hippo-translation-service: Healthy.
- All other services: Healthy.

## Residual Warnings
- Apache logs show SSL warnings about self-signed CA and missing SSL session cache. These do not affect startup in development.

## Files Modified
- `docker/apache/httpd.conf`
- `services/api-gateway/src/middleware/validators.ts`
- `services/api-gateway/Dockerfile`
- `docker/apache/ssl/server.crt`
- `docker/apache/ssl/server.key`

## Follow-Up Recommendations
- Replace dev SSL certs with proper non-CA self-signed cert or production certs.
- Add `SSLSessionCache` configuration if SSL warnings should be eliminated.

