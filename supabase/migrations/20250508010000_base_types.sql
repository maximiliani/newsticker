BEGIN;

-- Enable UUID generation for user IDs and other unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define media types enum for Instagram content
-- Used to distinguish between different types of media in posts
CREATE TYPE media_type AS ENUM ('image', 'video');

COMMIT;