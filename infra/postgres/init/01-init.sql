-- Runs once when the postgres volume is first created.
-- Schema objects are managed by Flyway in workpulse-backend; this only prepares extensions
-- and a separate database for integration tests.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE DATABASE workpulse_test OWNER workpulse;
\connect workpulse_test
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
