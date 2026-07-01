-- E-Libra Database Schema
-- Run this once: psql -U postgres -d elib -f init.sql

-- Drop tables if re-initialising (safe for dev)
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  UNIQUE NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Books ──────────────────────────────────────────────────────────────────
-- Each book belongs to exactly one user.
-- The PDF binary is stored in the pdf_data BYTEA column.
CREATE TABLE books (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  author       VARCHAR(255) DEFAULT 'Unknown Author',
  genre        VARCHAR(100) DEFAULT 'Uncategorised',
  year         INTEGER,
  rating       NUMERIC(3,1) DEFAULT 4.0,
  description  TEXT,
  color        VARCHAR(20)  DEFAULT '#6C63FF',
  pdf_filename VARCHAR(255),
  pdf_size     BIGINT,
  pdf_data     BYTEA,          -- actual PDF file stored as binary
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- Index for fast user-scoped queries
CREATE INDEX idx_books_user_id ON books(user_id);
