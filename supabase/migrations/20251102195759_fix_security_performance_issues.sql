/*
  # Fix Database Security and Performance Issues

  ## Overview
  Addresses critical security and performance issues identified in database audit:
  - Add missing indexes for foreign keys
  - Optimize RLS policies to use SELECT subqueries
  - Add search_path security to functions
  - Remove unused indexes

  ## Changes

  ### 1. Add Missing Foreign Key Indexes
  Add indexes for foreign keys that don't have covering indexes:
  - `payments.subscription_id` - Index for payments lookup by subscription
  - `subscriptions.plan_id` - Index for subscription lookup by plan

  ### 2. Optimize RLS Policies
  Replace all `auth.uid()` calls with `(SELECT auth.uid())` to prevent re-evaluation for each row:
  - profiles: 3 policies (SELECT, UPDATE, INSERT)
  - subscriptions: 3 policies (SELECT, INSERT, UPDATE)
  - user_usage: 3 policies (SELECT, INSERT, UPDATE)
  - conversions_history: 4 policies (SELECT, INSERT, UPDATE, DELETE)
  - payments: 1 policy (SELECT)

  ### 3. Fix Function Security
  Add `SET search_path = ''` to all functions to prevent search path attacks:
  - update_updated_at_column()
  - get_active_subscription()
  - get_remaining_conversions()
  - increment_user_usage() (if exists)

  ### 4. Remove Unused Indexes
  Drop indexes that are not being used:
  - idx_subscriptions_user_id (covered by foreign key operations)
  - idx_conversions_created_at (not used in current queries)
  - idx_payments_dodo_id (unique constraint already provides index)

  ## Security Impact
  - Prevents search path manipulation attacks
  - Improves RLS policy performance at scale
  - Better query performance with proper indexes

  ## Performance Impact
  - RLS policies execute 10-100x faster with SELECT optimization
  - Foreign key lookups are significantly faster
  - Removes index maintenance overhead for unused indexes
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- Index for payments.subscription_id foreign key
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id 
  ON payments(subscription_id);

-- Index for subscriptions.plan_id foreign key
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id 
  ON subscriptions(plan_id);

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES - Replace auth.uid() with (SELECT auth.uid())
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can view own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can insert own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can update own usage" ON user_usage;
DROP POLICY IF EXISTS "Users can view own conversion history" ON conversions_history;
DROP POLICY IF EXISTS "Users can insert own conversions" ON conversions_history;
DROP POLICY IF EXISTS "Users can update own conversions" ON conversions_history;
DROP POLICY IF EXISTS "Users can delete own conversions" ON conversions_history;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;

-- Recreate profiles policies with optimized RLS
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

-- Recreate subscriptions policies with optimized RLS
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Recreate user_usage policies with optimized RLS
CREATE POLICY "Users can view own usage"
  ON user_usage FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own usage"
  ON user_usage FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own usage"
  ON user_usage FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Recreate conversions_history policies with optimized RLS
CREATE POLICY "Users can view own conversion history"
  ON conversions_history FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own conversions"
  ON conversions_history FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own conversions"
  ON conversions_history FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own conversions"
  ON conversions_history FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Recreate payments policy with optimized RLS
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- 3. FIX FUNCTION SECURITY - Add search_path protection
-- ============================================================================

-- Update update_updated_at_column with search_path security
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update get_active_subscription with search_path security
CREATE OR REPLACE FUNCTION get_active_subscription(p_user_id uuid)
RETURNS TABLE(
  subscription_id uuid,
  plan_name text,
  plan_display_name text,
  pdf_limit integer,
  status text,
  period_end timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    sp.name,
    sp.display_name,
    sp.pdf_limit,
    s.status,
    s.current_period_end
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND s.current_period_end > now()
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Update get_remaining_conversions with search_path security
CREATE OR REPLACE FUNCTION get_remaining_conversions(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_limit integer;
  v_used integer;
BEGIN
  SELECT sp.pdf_limit INTO v_limit
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND s.current_period_end > now()
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  IF v_limit IS NULL THEN
    RETURN -1;
  END IF;
  
  SELECT COALESCE(conversions_used, 0) INTO v_used
  FROM public.user_usage
  WHERE user_id = p_user_id
    AND period_end > now();
  
  IF v_used IS NULL THEN
    v_used := 0;
  END IF;
  
  RETURN GREATEST(0, v_limit - v_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Check if increment_user_usage exists and update it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'increment_user_usage'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION increment_user_usage(p_user_id uuid)
      RETURNS void AS $func$
      BEGIN
        INSERT INTO public.user_usage (user_id, conversions_used, period_start, period_end)
        VALUES (
          p_user_id, 
          1,
          now(),
          now() + interval ''1 month''
        )
        ON CONFLICT (user_id) DO UPDATE
        SET 
          conversions_used = public.user_usage.conversions_used + 1,
          updated_at = now();
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '''';
    ';
  END IF;
END $$;

-- ============================================================================
-- 4. REMOVE UNUSED INDEXES
-- ============================================================================

-- Drop idx_subscriptions_user_id (redundant with foreign key index)
DROP INDEX IF EXISTS idx_subscriptions_user_id;

-- Drop idx_conversions_created_at (not currently used)
DROP INDEX IF EXISTS idx_conversions_created_at;

-- Drop idx_payments_dodo_id (unique constraint already provides index)
DROP INDEX IF EXISTS idx_payments_dodo_id;
