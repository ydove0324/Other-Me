-- Migration: add image-related fields
-- Run this against the PostgreSQL database

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS comic_avatar_url VARCHAR(500);
