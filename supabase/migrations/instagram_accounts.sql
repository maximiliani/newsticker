-- Migration: Create tables for Instagram integration

-- Enable uuid extension (required for uuid_generate_v4)
create extension if not exists "uuid-ossp";

-- Table to store Instagram account credentials
create table if not exists public.instagram_accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id text unique not null,  -- Instagram user ID as string
  username text not null,
  profile_image_url text,
  access_token text not null,
  access_token_expires_at timestamp with time zone, -- optional expiration
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Table to store Instagram posts
create table if not exists public.instagram_posts (
  id uuid default uuid_generate_v4() primary key,
  instagram_user_id text not null references instagram_accounts(user_id) on delete cascade,
  instagram_post_id text unique not null,
  caption text,
  media_type text not null, -- e.g. IMAGE, VIDEO
  media_url text not null, -- public URL in Supabase Storage or external URL
  timestamp timestamp with time zone not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Table to store media items for carousel posts (multiple media per post)
create table if not exists public.instagram_post_media (
  id uuid default uuid_generate_v4() primary key,
  instagram_post_id uuid not null references instagram_posts(id) on delete cascade,
  media_type text not null, -- IMAGE, VIDEO
  media_url text not null, -- public URL to media file
  thumbnail_url text,
  order_index integer not null, -- ordering of media items in the carousel
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes to improve performance
create index if not exists idx_instagram_accounts_username on public.instagram_accounts(username);
create index if not exists idx_instagram_posts_instagram_user_id on public.instagram_posts(instagram_user_id);
create index if not exists idx_instagram_post_media_instagram_post_id on public.instagram_post_media(instagram_post_id);

