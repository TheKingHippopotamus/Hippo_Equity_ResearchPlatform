# Configuration Directory

This directory contains configuration files for the Hippo Equity Research App.

## Structure

- `apache/` - Apache HTTP server configuration
- `postgres/` - PostgreSQL initialization scripts
- Service-specific configuration files

## Environment Variables

All environment variables are defined in `.env` file at the root of the project.
Copy `.env.example` to `.env` and update with your actual values.

## Security Notes

- Never commit `.env` files to version control
- Use strong passwords in production
- Replace self-signed SSL certificates with real certificates in production
- Store API keys securely using environment variables or secret management systems

