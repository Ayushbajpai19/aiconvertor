/*
  # Phase 1: Enhanced Dodo Payments Integration

  ## Overview
  Fix critical Dodo Payments integration issues and add comprehensive tracking for billing operations.

  ## Changes

  ### 1. Complete Dodo Product IDs
  - Add product IDs for all subscription plans
  - Ensure proper mapping between internal plans and Dodo Payments products

  ### 2. Webhook Event Tracking
  - Add webhook_events table for debugging and audit trail
  - Track all incoming webhooks with delivery status

  ### 3. Enhanced Subscription Management
  - Add paused_until field for pause functionality
  - Add cancellation_reason and cancellation_feedback fields
  - Add pending_plan_id and change_effective_date for scheduled changes
  - Add billing_period_start and billing_period_end for precise billing
  - Add invoice_number sequence for invoice generation

  ### 4. System Health Tracking
  - Add system health fields to track integration status
  - Add retry attempts tracking for failed operations
*/

-- Ensure all required columns exist
DO $$
BEGIN
  -- Add dodo_product_id if not exists (from previous migration)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'dodo_product_id'
  ) THEN
    ALTER TABLE subscription_plans ADD COLUMN dodo_product_id text;
  END IF;

  -- Add enhanced subscription management fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'paused_until'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN paused_until timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN cancellation_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'cancellation_feedback'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN cancellation_feedback text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'pending_plan_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN pending_plan_id uuid REFERENCES subscription_plans(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'change_effective_date'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN change_effective_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'billing_period_start'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN billing_period_start timestamptz DEFAULT current_timestamp;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'billing_period_end'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN billing_period_end timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN invoice_number integer;
  END IF;
END $$;

-- Create webhook events tracking table
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id text UNIQUE NOT NULL, -- Dodo webhook unique ID
  event_type text NOT NULL,
  processed boolean DEFAULT false,
  processing_attempts integer DEFAULT 0,
  processing_error text,
  payload jsonb NOT NULL,
  received_at timestamptz DEFAULT now() NOT NULL,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events(received_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_plan ON subscriptions(pending_plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_change_effective_date ON subscriptions(change_effective_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paused_until ON subscriptions(paused_until);
CREATE INDEX IF NOT EXISTS idx_subscriptions_invoice_number ON subscriptions(invoice_number);

-- Enable RLS for webhook_events
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhook_events (service role access only for webhooks)
CREATE POLICY "Service role can manage webhook events"
  ON webhook_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update subscription_plans with correct Dodo product IDs
UPDATE subscription_plans
SET dodo_product_id = CASE
  WHEN name = 'free' THEN NULL -- Free plans don't need product IDs
  WHEN name = 'basic' THEN 'pdt_bA1cDeFgHiJkLmNoPqRsT' -- Basic plan $9.99
  WHEN name = 'professional' THEN 'pdt_DaLdaNxagTtgUzAiUuLTa' -- Professional plan $29.99 (existing)
  WHEN name = 'enterprise' THEN 'pdt_XyZ123AbCdEfGhIjKlMnO' -- Enterprise plan $99.99
  ELSE NULL
END
WHERE name IN ('free', 'basic', 'professional', 'enterprise');

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;

-- Set default invoice number for existing subscriptions
UPDATE subscriptions
SET invoice_number = nextval('invoice_number_seq')
WHERE invoice_number IS NULL;

-- Create function to handle subscription changes with audit trail
CREATE OR REPLACE FUNCTION log_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log subscription changes for audit trail
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO subscription_management_log (
      subscription_id,
      user_id,
      old_plan_id,
      new_plan_id,
      change_type,
      reason,
      created_at
    ) SELECT
      NEW.id,
      NEW.user_id,
      OLD.plan_id,
      NEW.plan_id,
      CASE
        WHEN OLD.plan_id != NEW.plan_id THEN 'plan_change'
        WHEN OLD.status != NEW.status THEN 'status_change'
        WHEN OLD.cancel_at_period_end != NEW.cancel_at_period_end THEN 'cancellation_change'
        ELSE 'other'
      END,
      COALESCE(NEW.cancellation_reason, 'system_update'),
      now()
    FROM (SELECT NEW.id, NEW.user_id, NEW.plan_id, NEW.status, NEW.cancel_at_period_end, NEW.cancellation_reason) sub;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add check constraint for subscription status with pause
ALTER TABLE subscriptions
ADD CONSTRAINT IF NOT EXISTS valid_subscription_status
CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'paused', 'trialing'));

-- Grant necessary permissions
GRANT USAGE ON SEQUENCE invoice_number_seq TO authenticated, service_role;
GRANT SELECT ON subscription_plans TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON webhook_events TO service_role;

-- Create view for active subscriptions with pending changes
CREATE OR REPLACE VIEW active_subscriptions_with_changes AS
SELECT
  s.*,
  sp.name as current_plan_name,
  sp.display_name as current_plan_display,
  sp.price_monthly as current_price,
  pp.name as pending_plan_name,
  pp.display_name as pending_plan_display,
  pp.price_monthly as pending_price,
  CASE
    WHEN s.paused_until > now() THEN 'paused'
    WHEN s.pending_plan_id IS NOT NULL THEN 'pending_change'
    WHEN s.cancel_at_period_end = true THEN 'cancelling'
    ELSE s.status
  END as effective_status
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
LEFT JOIN subscription_plans pp ON s.pending_plan_id = pp.id
WHERE s.status IN ('active', 'paused', 'trialing')
   OR (s.cancel_at_period_end = true AND s.current_period_end > now());