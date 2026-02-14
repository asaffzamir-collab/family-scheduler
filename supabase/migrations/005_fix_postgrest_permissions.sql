-- ============================================
-- Fix: Grant PostgREST roles access to tables
-- ============================================
-- Tables were created via raw SQL but PostgREST roles
-- (anon, authenticated, service_role) were not granted
-- access, causing PGRST205 "table not found in schema cache".

-- Grant permissions on all existing tables
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensure future tables also get the right grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Reload PostgREST schema cache so it picks up the tables
NOTIFY pgrst, 'reload schema';
