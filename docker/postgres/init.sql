-- PostgreSQL initialization script for Hippo Equity Research App
-- This script runs automatically when the database container is first created

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema for stock data
CREATE SCHEMA IF NOT EXISTS stock_data;

-- Create schema for user preferences
CREATE SCHEMA IF NOT EXISTS user_preferences;

-- Create schema for reports metadata
CREATE SCHEMA IF NOT EXISTS reports_metadata;

-- Grant permissions
DO $$
BEGIN
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA stock_data TO %I', current_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA user_preferences TO %I', current_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA reports_metadata TO %I', current_user);
END $$;

-- Run migrations
-- Note: In production, use a proper migration tool like Flyway or Alembic
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'stock_data' AND table_name = 'stocks') THEN
        RAISE NOTICE 'Migrations already applied, skipping...';
    ELSE
        \i /docker-entrypoint-initdb.d/migrations/001_initial_schema.sql
    END IF;
END $$;
