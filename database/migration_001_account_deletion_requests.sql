-- Migration: 001_account_deletion_requests
-- Description: Creates table to persist account deletion requests from web form
-- Database: PostgreSQL
-- Usage: psql -U your_user -d your_database -f migration_001_account_deletion_requests.sql

BEGIN;

-- Create enum for request status
DO $$ BEGIN
  CREATE TYPE deletion_request_status AS ENUM (
    'pending',       -- Solicitud recibida, esperando confirmacion del usuario
    'confirmed',     -- Usuario confirmo que desea eliminar
    'processing',    -- Eliminacion en proceso
    'completed',     -- Cuenta eliminada exitosamente
    'rejected',      -- Solicitud rechazada (por ejemplo, datos no coinciden)
    'cancelled'      -- Usuario cancelo la solicitud
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create the table
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification
  email             VARCHAR(255) NOT NULL,
  full_name         VARCHAR(255) NOT NULL,
  phone             VARCHAR(20)  NOT NULL,
  user_id           UUID, -- Populated if user still exists in users table
  
  -- Request metadata
  reason            VARCHAR(50),
  comments          TEXT,
  status            deletion_request_status NOT NULL DEFAULT 'pending',
  
  -- Admin tracking
  admin_notes       TEXT,
  processed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Verification
  verification_code VARCHAR(64),     -- Code sent via email for confirmation
  verified_at       TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,  -- When we sent the initial confirmation email
  
  -- Completion tracking
  account_deleted_at TIMESTAMPTZ,    -- When account was actually deleted
  data_anonymized_at TIMESTAMPTZ,    -- When remaining data was anonymized
  final_email_sent_at TIMESTAMPTZ,   -- When final confirmation was sent
  
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Source tracking
  source            VARCHAR(20) NOT NULL DEFAULT 'web' -- 'web', 'app', 'email'
);

-- Indexes for performance
CREATE INDEX idx_deletion_requests_email ON account_deletion_requests(email);
CREATE INDEX idx_deletion_requests_status ON account_deletion_requests(status);
CREATE INDEX idx_deletion_requests_created_at ON account_deletion_requests(created_at);
CREATE INDEX idx_deletion_requests_user_id ON account_deletion_requests(user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_deletion_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deletion_request_updated_at ON account_deletion_requests;
CREATE TRIGGER trg_deletion_request_updated_at
  BEFORE UPDATE ON account_deletion_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_deletion_request_timestamp();

COMMIT;

-- ============================================================================
-- DOWN MIGRATION (if needed to revert):
-- ============================================================================
-- DROP TRIGGER IF EXISTS trg_deletion_request_updated_at ON account_deletion_requests;
-- DROP FUNCTION IF EXISTS update_deletion_request_timestamp();
-- DROP TABLE IF EXISTS account_deletion_requests;
-- DROP TYPE IF EXISTS deletion_request_status;
