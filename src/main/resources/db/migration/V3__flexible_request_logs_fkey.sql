-- Migration V3: Flexible audit logging for unauthenticated and rejected requests
-- Allows recording 401 rejected requests with unknown/malformed virtual keys without FK violations

ALTER TABLE request_logs DROP CONSTRAINT IF EXISTS request_logs_virtual_key_fkey;
