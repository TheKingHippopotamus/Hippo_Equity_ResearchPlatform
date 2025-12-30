# Database Migrations

This directory contains SQL migration files for the PostgreSQL database.

## Migration Files

- `001_initial_schema.sql` - Initial database schema with all required tables and indexes

## Running Migrations

Migrations are automatically run when the PostgreSQL container starts using the init.sql script.

For manual execution:
```bash
psql -U hippo_user -d hippo_db -f migrations/001_initial_schema.sql
```

## Schema Overview

### stock_data Schema
- `stocks` - Stock price and trading data
- `news_articles` - News articles related to stocks
- `financial_analysis` - Financial analysis data for stocks

### user_preferences Schema
- `preferences` - User preferences including language and theme

### reports_metadata Schema
- `reports` - Metadata for generated PDF reports

## Indexes

All tables have appropriate indexes for common query patterns:
- Symbol lookups
- Date/time range queries
- User ID lookups
- Created/updated timestamp queries

