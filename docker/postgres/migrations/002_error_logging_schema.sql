-- Migration: Error Logging Schema
-- Description: Creates error_logs table for comprehensive error tracking
-- Created: 2024-12-29
-- Phase: 7 - Error Handling & Validation

-- Create schema for error logging
CREATE SCHEMA IF NOT EXISTS error_logging;

-- Error Logs Table
CREATE TABLE IF NOT EXISTS error_logging.error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    status_code INTEGER,
    method VARCHAR(10),
    url TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    service_name VARCHAR(100),
    request_body JSONB,
    response_body JSONB,
    user_id VARCHAR(255),
    severity VARCHAR(20) DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'critical')),
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_status_code CHECK (status_code IS NULL OR (status_code >= 100 AND status_code < 600))
);

-- Indexes for error_logging.error_logs
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logging.error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_status_code ON error_logging.error_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_error_logs_service_name ON error_logging.error_logs(service_name);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logging.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logging.error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logging.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_ip_address ON error_logging.error_logs(ip_address);

-- Grant permissions
DO $$
BEGIN
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA error_logging TO %I', current_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA error_logging TO %I', current_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA error_logging TO %I', current_user);
END $$;

-- Function to automatically clean up old error logs (older than 90 days)
CREATE OR REPLACE FUNCTION error_logging.cleanup_old_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM error_logging.error_logs
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND resolved = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment on table
COMMENT ON TABLE error_logging.error_logs IS 'Stores application errors for monitoring and debugging';
COMMENT ON COLUMN error_logging.error_logs.severity IS 'Error severity: error, warning, or critical';
COMMENT ON COLUMN error_logging.error_logs.resolved IS 'Whether the error has been resolved or acknowledged';
