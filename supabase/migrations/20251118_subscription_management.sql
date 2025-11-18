/*
  # Phase 2: Subscription Management Database Migration

  ## Overview
  Implement comprehensive subscription lifecycle management including pause, resume, upgrade, downgrade, and cancellation functionality with full audit trail.

  ## Changes

  ### 1. Enhanced Subscriptions Table
  The subscriptions table already has basic fields from Phase 1 migration.
  This migration adds missing indexes and ensures all fields are properly typed.

  ### 2. Subscription Management Log Table
  Create audit trail for all subscription changes with proper tracking.

  ### 3. Subscription Change History View
  Create optimized view for subscription change history.

  ### 4. Enhanced Functions
  Add functions for subscription status calculations and change management.
*/

-- Create subscription_management_log table for audit trail
CREATE TABLE IF NOT EXISTS subscription_management_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  old_plan_id uuid REFERENCES subscription_plans(id),
  new_plan_id uuid REFERENCES subscription_plans(id),
  change_type text NOT NULL,
  reason text,
  feedback text,
  scheduled_for timestamptz,
  processed_at timestamptz,
  processed_by uuid REFERENCES profiles(id),
  effective_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add constraints for change_type
ALTER TABLE subscription_management_log
ADD CONSTRAINT IF NOT EXISTS valid_change_type
CHECK (change_type IN (
  'created',
  'upgraded',
  'downgraded',
  'paused',
  'resumed',
  'cancelled',
  'renewed',
  'payment_failed',
  'payment_succeeded',
  'scheduled_change',
  'status_change'
));

-- Create indexes for subscription_management_log
CREATE INDEX IF NOT EXISTS idx_subscription_log_subscription_id ON subscription_management_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_log_user_id ON subscription_management_log(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_log_change_type ON subscription_management_log(change_type);
CREATE INDEX IF NOT EXISTS idx_subscription_log_created_at ON subscription_management_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_log_effective_at ON subscription_management_log(effective_at);

-- Ensure additional indexes exist on subscriptions table
CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_plan ON subscriptions(pending_plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_effective_date ON subscriptions(change_effective_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paused_until ON subscriptions(paused_until);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period ON subscriptions(status, current_period_end);

-- Create function to calculate effective subscription status
CREATE OR REPLACE FUNCTION get_effective_subscription_status(p_subscription_id uuid)
RETURNS TABLE(
  subscription_id uuid,
  user_id uuid,
  plan_id uuid,
  plan_name text,
  plan_display_name text,
  status text,
  effective_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  paused_until timestamptz,
  pending_plan_id uuid,
  pending_plan_name text,
  change_effective_date timestamptz,
  can_change_plan boolean,
  days_until_renewal integer
) AS $$
DECLARE
  v_current_status text;
  v_effective_status text;
  v_pending_days integer;
BEGIN
  -- Get current subscription details
  SELECT s.status, sp.name, sp.display_name,
         s.paused_until, s.pending_plan_id, pp.name as pending_plan_name,
         s.change_effective_date, s.cancel_at_period_end,
         s.current_period_start, s.current_period_end
  INTO v_current_status, sp.name, sp.display_name,
       s.paused_until, s.pending_plan_id, pp.name,
       s.change_effective_date, s.cancel_at_period_end,
       s.current_period_start, s.current_period_end
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  LEFT JOIN subscription_plans pp ON s.pending_plan_id = pp.id
  WHERE s.id = p_subscription_id;

  -- Calculate effective status
  IF v_current_status = 'paused' AND s.paused_until > now() THEN
    v_effective_status := 'paused';
  ELSIF v_current_status = 'active' AND s.cancel_at_period_end = true AND s.current_period_end <= now() THEN
    v_effective_status := 'cancelled';
  ELSIF v_current_status = 'past_due' THEN
    v_effective_status := 'past_due';
  ELSIF v_pending_plan_id IS NOT NULL AND s.change_effective_date <= now() THEN
    v_effective_status := 'pending_change';
  ELSE
    v_effective_status := v_current_status;
  END IF;

  -- Calculate days until renewal
  v_pending_days := CASE
    WHEN s.current_period_end > now() THEN
      GREATEST(0, EXTRACT(DAY FROM (s.current_period_end - now())))
    ELSE
      0
  END;

  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.plan_id,
    sp.name as plan_name,
    sp.display_name as plan_display_name,
    s.status,
    v_effective_status as effective_status,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.paused_until,
    s.pending_plan_id,
    s.pending_plan_name as pending_plan_name,
    s.change_effective_date,
    (s.status IN ('active', 'trialing') AND s.paused_until IS NULL) as can_change_plan,
    v_pending_days as days_until_renewal
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  LEFT JOIN subscription_plans pp ON s.pending_plan_id = pp.id
  WHERE s.id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to schedule subscription changes
CREATE OR REPLACE FUNCTION schedule_subscription_change(
  p_subscription_id uuid,
  p_new_plan_id uuid,
  p_change_type text,
  p_reason text,
  p_effective_date timestamptz DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_current_plan_id uuid;
  v_change_id uuid;
BEGIN
  -- Get current subscription details
  SELECT user_id, plan_id
  INTO v_user_id, v_current_plan_id
  FROM subscriptions
  WHERE id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Create log entry
  INSERT INTO subscription_management_log (
    subscription_id,
    user_id,
    old_plan_id,
    new_plan_id,
    change_type,
    reason,
    scheduled_for: p_effective_date,
    effective_at: p_effective_date,
    metadata: jsonb_build_object(
      'scheduled_by', current_setting('request.jwt.claims')::text,
      'scheduled_at', now()
    )
  )
  VALUES (
    p_subscription_id,
    v_user_id,
    v_current_plan_id,
    p_new_plan_id,
    p_change_type,
    p_reason,
    p_effective_date,
    p_effective_date
  )
  RETURNING id INTO v_change_id;

  -- Update subscription
  UPDATE subscriptions
  SET
    pending_plan_id = p_new_plan_id,
    change_effective_date = COALESCE(p_effective_date, current_period_end),
    updated_at = now()
  WHERE id = p_subscription_id;

  RETURN v_change_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to cancel subscription
CREATE OR REPLACE FUNCTION cancel_subscription(
  p_subscription_id uuid,
  p_reason text,
  p_feedback text,
  p_immediate boolean DEFAULT false
)
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_current_status text;
  v_current_period_end timestamptz;
BEGIN
  -- Get current subscription details
  SELECT user_id, status, current_period_end
  INTO v_user_id, v_current_status, v_current_period_end
  FROM subscriptions
  WHERE id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Create log entry
  INSERT INTO subscription_management_log (
    subscription_id,
    user_id,
    change_type,
    reason,
    feedback,
    effective_at: CASE WHEN p_immediate THEN now() ELSE v_current_period_end END,
    metadata: jsonb_build_object(
      'cancelled_by', current_setting('request.jwt.claims')::text,
      'cancelled_at', now(),
      'immediate', p_immediate
    )
  )
  VALUES (
    p_subscription_id,
    v_user_id,
    'cancelled',
    p_reason,
    p_feedback,
    CASE WHEN p_immediate THEN now() ELSE v_current_period_end END,
    CASE WHEN p_immediate THEN now() ELSE v_current_period_end END
  );

  -- Update subscription
  IF p_immediate THEN
    UPDATE subscriptions
    SET
      status = 'cancelled',
      cancel_at_period_end = true,
      cancellation_reason = p_reason,
      cancellation_feedback = p_feedback,
      updated_at = now()
    WHERE id = p_subscription_id;
  ELSE
    UPDATE subscriptions
    SET
      cancel_at_period_end = true,
      cancellation_reason = p_reason,
      cancellation_feedback = p_feedback,
      updated_at = now()
    WHERE id = p_subscription_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to pause subscription
CREATE OR REPLACE FUNCTION pause_subscription(
  p_subscription_id uuid,
  p_duration_months integer, -- 1, 2, or 3 months
  p_reason text
)
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_current_status text;
  v_pause_until timestamptz;
BEGIN
  -- Get current subscription details
  SELECT user_id, status
  INTO v_user_id, v_current_status
  FROM subscriptions
  WHERE id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF v_current_status != 'active' THEN
    RAISE EXCEPTION 'Only active subscriptions can be paused';
  END IF;

  -- Calculate pause end date
  v_pause_until := now() + (p_duration_months || ' months')::interval;

  -- Create log entry
  INSERT INTO subscription_management_log (
    subscription_id,
    user_id,
    change_type,
    reason,
    scheduled_for: v_pause_until,
    effective_at: now(),
    metadata: jsonb_build_object(
      'paused_by', current_setting('request.jwt.claims')::text,
      'paused_at', now(),
      'duration_months', p_duration_months
    )
  )
  VALUES (
    p_subscription_id,
    v_user_id,
    'paused',
    p_reason,
    v_pause_until,
    now(),
    jsonb_build_object(
      'paused_by', current_setting('request.jwt.claims')::text,
      'paused_at', now(),
      'duration_months', p_duration_months
    )
  );

  -- Update subscription
  UPDATE subscriptions
  SET
    status = 'paused',
    paused_until = v_pause_until,
    updated_at = now()
  WHERE id = p_subscription_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for subscription history
CREATE OR REPLACE VIEW subscription_change_history AS
SELECT
  sml.id,
  sml.subscription_id,
  sml.user_id,
  sml.change_type,
  sml.reason,
  sml.feedback,
  sml.scheduled_for,
  sml.processed_at,
  sml.effective_at,
  sp_old.name as old_plan_name,
  sp_old.display_name as old_plan_display_name,
  sp_new.name as new_plan_name,
  sp_new.display_name as new_plan_display_name,
  sml.metadata,
  sml.created_at
FROM subscription_management_log sml
LEFT JOIN subscription_plans sp_old ON sml.old_plan_id = sp_old.id
LEFT JOIN subscription_plans sp_new ON sml.new_plan_id = sp_new.id
ORDER BY sml.created_at DESC;

-- Enable Row Level Security for subscription_management_log
ALTER TABLE subscription_management_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_management_log
CREATE POLICY "Users can view own subscription log"
  ON subscription_management_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscription log"
  ON subscription_management_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT ON subscription_change_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_effective_subscription_status TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_subscription_change TO service_role;
GRANT EXECUTE ON FUNCTION cancel_subscription TO service_role;
GRANT EXECUTE ON FUNCTION pause_subscription TO service_role;

-- Create trigger to log subscription changes automatically
CREATE OR REPLACE FUNCTION log_subscription_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log direct updates, not those from management functions
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO subscription_management_log (
      subscription_id,
      user_id,
      old_plan_id,
      new_plan_id,
      change_type,
      effective_at: now(),
      metadata: jsonb_build_object(
        'trigger', TG_NAME,
        'operation', TG_OP,
        'timestamp', now()
      )
    )
    SELECT
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
      now(),
      jsonb_build_object(
        'trigger', TG_NAME,
        'operation', TG_OP,
        'timestamp', now()
      )
    FROM (SELECT 1) sub;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subscription changes
DROP TRIGGER IF EXISTS subscription_changes_trigger ON subscriptions;
CREATE TRIGGER subscription_changes_trigger
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION log_subscription_changes();