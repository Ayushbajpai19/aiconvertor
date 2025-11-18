/*
  # Phase 5: Admin Database Views and Analytics

  ## Overview
  Create comprehensive admin views and functions for user management, revenue analytics, and system health monitoring.

  ## Changes

  ### 1. Admin Analytics Views
  - User activity and engagement metrics
  - Revenue breakdowns by plan and time period
  - Churn analysis and retention metrics
  - System performance and error tracking

  ### 2. Admin Functions
  - User management functions
  - Revenue aggregation functions
  - Churn prediction and analysis
  - System health monitoring functions

  ### 3. Performance Optimizations
  - Efficient indexes for admin queries
  - Materialized views for fast admin analytics
  - Aggregate functions for dashboard metrics

  ### 4. Security and Access Control
  - Role-based access controls
  - Admin-only functions and views
  - Audit logging for admin actions
*/

-- Create admin revenue view
CREATE MATERIALIZED VIEW IF NOT EXISTS admin_revenue_analytics AS
WITH monthly_revenue AS (
  SELECT
    DATE_TRUNC('month', i.created_at) as month,
    sp.name as plan_name,
    sp.display_name as plan_display_name,
    sp.price_monthly as plan_price,
    COUNT(DISTINCT i.user_id) as new_customers,
    COUNT(DISTINCT CASE WHEN s.created_at >= DATE_TRUNC('month', i.created_at) - INTERVAL '12 months' THEN i.user_id END) as returning_customers,
    COUNT(DISTINCT i.user_id) as active_customers,
    SUM(p.total_amount) as monthly_revenue,
    COUNT(i.id) as total_invoices,
    COUNT(CASE WHEN p.status = 'paid' THEN 1 END) as paid_invoices,
    AVG(p.total_amount) as avg_invoice_amount,
    SUM(CASE WHEN p.status = 'paid' THEN p.total_amount ELSE 0 END) as paid_revenue,
    -- Churn metrics
    COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_invoices,
    COUNT(CASE WHEN s.status = 'refunded' THEN 1 END) as refunded_invoices,
    -- Count subscriptions by plan for churn analysis
    COUNT(DISTINCT s.user_id) FILTER (WHERE sp.name = 'free') as free_users,
    COUNT(DISTINCT s.user_id) FILTER (WHERE sp.name = 'basic') as basic_users,
    COUNT(DISTINCT s.user_id) FILTER (WHERE sp.name = 'professional') as professional_users,
    COUNT(DISTINCT s.user_id) FILTER (WHERE sp.name = 'enterprise') as enterprise_users
  FROM invoices i
  JOIN subscriptions s ON i.subscription_id = s.id
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE i.created_at >= '2024-01-01'
  GROUP BY DATE_TRUNC('month', i.created_at), sp.name, sp.display_name, sp.price_monthly
)
SELECT
  mr.month,
  mr.plan_name,
  mr.plan_display_name,
  mr.plan_price,
  mr.new_customers,
  mr.returning_customers,
  mr.active_customers,
  mr.monthly_revenue,
  mr.total_invoices,
  mr.paid_invoices,
  mr.avg_invoice_amount,
  mr.paid_revenue,
  mr.cancelled_invoices,
  mr.refunded_invoices,
  mr.free_users,
  mr.basic_users,
  mr.professional_users,
  mr.enterprise_users,
  -- Churn rate calculation
  CASE
    WHEN mr.active_customers > 0 THEN
      ROUND(((mr.active_customers - mr.returning_customers) * 100.0 / mr.active_customers, 2)
    ELSE 0
  END as churn_rate_percent,
  -- Revenue per customer
  CASE
    WHEN mr.active_customers > 0 THEN
      ROUND(mr.paid_revenue / mr.active_customers, 2)
    ELSE 0
  END as revenue_per_customer
FROM monthly_revenue mr;

-- Create unique index for admin revenue view
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_revenue_month_plan
ON admin_revenue_analytics(month, plan_name);

-- Create admin user activity view
CREATE MATERIALIZED VIEW IF NOT EXISTS admin_user_activity AS
SELECT
  DATE_TRUNC('day', c.created_at) as date,
  COUNT(DISTINCT c.user_id) as daily_active_users,
  COUNT(c.id) as daily_conversions,
  COUNT(CASE WHEN c.status = 'success' THEN 1 END) as successful_conversions,
  ROUND(COUNT(CASE WHEN c.status = 'success' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as success_rate_percent,
  COUNT(DISTINCT CASE WHEN c.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN c.user_id END) as weekly_active_users,
  COUNT(DISTINCT CASE WHEN c.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN c.user_id END) as monthly_active_users,
  AVG(c.file_size) / 1024.0 / 1024.0 as avg_file_size_mb,
  SUM(c.file_size) / 1024.0 / 1024.0 as total_file_size_mb,
  -- Conversion frequency
  COUNT(c.id) FILTER (WHERE c.user_id IN (
    SELECT c.user_id FROM conversions_history c_prev
    WHERE c_prev.created_at < DATE_TRUNC('day', c.created_at) - INTERVAL '1 day'
  )) / COUNT(DISTINCT c.user_id) as avg_conversions_per_user
FROM conversions_history c
JOIN subscriptions s ON c.user_id = s.user_id
WHERE c.created_at >= '2024-01-01'
GROUP BY DATE_TRUNC('day', c.created_at);

-- Create index for admin user activity view
CREATE INDEX IF NOT EXISTS idx_admin_user_activity_date ON admin_user_activity(date DESC);
CREATE INDEX IF NOT EXISTS idx_admin_user_activity_users ON admin_user_activity(daily_active_users);

-- Create admin system health view
CREATE MATERIALIZED VIEW IF NOT EXISTS admin_system_health AS
SELECT
  CURRENT_DATE as check_date,
  COUNT(CASE WHEN we.created_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as webhook_events_today,
  COUNT(CASE WHEN we.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as webhook_events_week,
  COUNT(CASE WHEN we.processing_error IS NOT NULL THEN 1 END) as webhook_errors_week,
  AVG(CASE WHEN we.processing_attempts > 0 THEN we.processing_attempts ELSE NULL END) as avg_processing_attempts,
  COUNT(CASE WHEN s.id IS NOT NULL THEN 1 END) as active_subscriptions,
  COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_users,
  COUNT(CASE WHEN s.status = 'past_due' THEN 1 END) as past_due_users,
  COUNT(CASE WHEN s.status = 'cancelled' THEN 1 END) as cancelled_users,
  COUNT(CASE WHEN s.status = 'paused' THEN 1 END) as paused_users,
  -- Payment metrics
  COUNT(p.id) as total_invoices_today,
  COUNT(CASE WHEN p.status = 'paid' THEN 1 END) as paid_invoices_today,
  SUM(CASE WHEN p.status = 'paid' THEN p.total_amount ELSE 0 END) as paid_revenue_today,
  COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_payments_today,
  -- Conversion metrics
  COUNT(c.id) as total_conversions_today,
  COUNT(CASE WHEN c.status = 'success' THEN 1 END) as successful_conversions_today,
  ROUND(COUNT(CASE WHEN c.status = 'success' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as success_rate_today
FROM webhook_events we
LEFT JOIN invoices p ON we.payload->>'subscription_id' = p.id::text
LEFT JOIN subscriptions s ON p.subscription_id = s.id
WHERE we.created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Create admin churn analysis view
CREATE MATERIALIZED VIEW IF NOT EXISTS admin_churn_analysis AS
WITH monthly_churn AS (
  SELECT
    DATE_TRUNC('month', s.created_at) as month,
    sp.name as plan_name,
    COUNT(DISTINCT s.user_id) as total_users,
    COUNT(DISTINCT s.user_id) FILTER (WHERE s.status = 'cancelled') as churned_users,
    COUNT(DISTINCT CASE WHEN s.status = 'cancelled' AND s.created_at >= DATE_TRUNC('month', s.created_at) - INTERVAL '12 months' THEN s.user_id END) as new_users_in_previous_12m,
    COUNT(DISTINCT CASE WHEN s.status = 'cancelled' AND s.created_at >= DATE_TRUNC('month', s.created_at) - INTERVAL '6 months' THEN s.user_id END) as returning_users_in_previous_6m,
    COUNT(DISTINCT CASE WHEN s.status = 'cancelled' AND s.created_at >= DATE_TRUNC('month', s.created_at) - INTERVAL '3 months' THEN s.user_id END) as returning_users_in_previous_3m,
    COUNT(DISTINCT CASE WHEN s.status = 'cancelled' AND s.created_at >= DATE_TRUNC('month', s.created_at) - INTERVAL '1 months' THEN s.user_id END) as returning_users_in_previous_1m
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.created_at >= '2024-01-01'
    GROUP BY DATE_TRUNC('month', s.created_at), sp.name
)
SELECT
  mc.month,
  mc.plan_name,
  mc.total_users,
  mc.churned_users,
  mc.new_users_in_previous_12m,
  mc.returning_users_in_previous_6m,
  mc.returning_users_in_previous_3m,
  mc.returning_users_in_previous_1m,
  -- Churn rate calculations
  CASE
    WHEN mc.total_users > 0 THEN
      ROUND((mc.churned_users * 100.0) / mc.total_users, 2)
    ELSE 0
  END as monthly_churn_rate_percent,
  CASE
    WHEN mc.new_users_in_previous_12m > 0 THEN
      ROUND((mc.new_users_in_previous_12m * 100.0) / (mc.total_users - mc.churned_users), 2)
    ELSE 0
  END as churn_adjustment_rate_12m_percent,
  -- Retention rate
  CASE
    WHEN mc.total_users > 0 THEN
      ROUND(((mc.total_users - mc.churned_users) * 100.0) / mc.total_users, 2)
    ELSE 0
  END as retention_rate_12m_percent
FROM monthly_churn mc;

-- Create admin plan performance view
CREATE MATERIALIZED VIEW IF NOT EXISTS admin_plan_performance AS
SELECT
  sp.name as plan_name,
  sp.display_name as plan_display_name,
  sp.price_monthly as plan_price,
  sp.pdf_limit,
  COUNT(DISTINCT s.user_id) as current_users,
  COUNT(DISTINCT s.user_id) FILTER (WHERE s.status = 'active' AND s.created_at >= CURRENT_DATE - INTERVAL '30 days') as active_users_30d,
  COUNT(DISTINCT s.user_id) FILTER (WHERE s.created_at >= CURRENT_DATE - INTERVAL '90 days') as active_users_90d,
  -- Usage metrics
  COUNT(DISTINCT c.user_id) FILTER (WHERE c.created_at >= CURRENT_DATE - INTERVAL '30 days')) as users_with_usage_30d,
  AVG(user_conversion_count.conversions_per_user) FILTER (WHERE c.user_id IN (
    SELECT uc.user_id FROM user_conversion_count uc
    WHERE uc.conversion_date >= CURRENT_DATE - INTERVAL '30 days'
  )) as avg_conversions_per_user_30d,
  -- Revenue metrics
  COUNT(i.id) FILTER (WHERE i.created_at >= CURRENT_DATE - INTERVAL '30 days')) as invoices_30d,
  SUM(i.total_amount) FILTER (WHERE i.created_at >= CURRENT_DATE - INTERVAL '30 days' AND i.status = 'paid') as revenue_30d,
  -- Churn metrics
  COUNT(DISTINCT s.user_id) FILTER (WHERE s.status = 'cancelled' AND s.created_at >= CURRENT_DATE - INTERVAL '30 days')) as churned_users_30d,
  ROUND(COUNT(DISTINCT s.user_id FILTER (WHERE s.status = 'cancelled' AND s.created_at >= CURRENT_DATE - INTERVAL '30 days')) * 100.0 / NULLIF(COUNT(DISTINCT s.user_id FILTER (WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days')), 0), 2) as churn_rate_30d_percent,
  -- Lifetime value (LTV)
  ROUND(SUM(i.total_amount) FILTER (WHERE i.created_at >= CURRENT_DATE - INTERVAL '30 days' AND i.status = 'paid') / COUNT(DISTINCT s.user_id FILTER (WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days')), 2) as avg_ltv_30d
FROM subscription_plans sp
LEFT JOIN subscriptions s ON s.plan_id = sp.id
LEFT JOIN invoices i ON i.subscription_id = s.id
LEFT JOIN conversions_history c ON c.user_id = s.user_id
LEFT JOIN LATERAL (
  SELECT uc.user_id, COUNT(*) as conversions_per_user, uc.conversion_date
  FROM user_conversion_count uc
  WHERE uc.conversion_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY uc.user_id
) user_conversion_count ON c.user_id = user_conversion_count.user_id
WHERE s.created_at >= '2024-01-01'
GROUP BY sp.name, sp.display_name, sp.price_monthly, sp.pdf_limit;

-- Create indexes for admin views
CREATE INDEX IF NOT EXISTS idx_admin_churn_month_plan ON admin_churn_analysis(month, plan_name);
CREATE INDEX IF NOT EXISTS idx_admin_plan_performance_plan ON admin_plan_performance(plan_name);
CREATE INDEX IF NOT EXISTS idx_admin_health_check_date ON admin_system_health(check_date DESC);

-- Create admin action log table
CREATE TABLE IF NOT EXISTS admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  action_details jsonb DEFAULT '{}'::jsonb,
  target_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  target_resource_id uuid,
  target_resource_type text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add constraints for admin action log
ALTER TABLE admin_action_log
ADD CONSTRAINT IF NOT EXISTS valid_admin_action_type
CHECK (action_type IN (
  'user_management',
  'subscription_override',
  'system_config',
  'data_export',
  'security_breach',
  'payment_refund',
  'invoice_manual',
  'system_maintenance',
  'analytics_view',
  'bulk_operation'
));

-- Enable Row Level Security
ALTER TABLE admin_action_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin views (admin only)
CREATE POLICY "Admin users can view admin analytics" ON admin_revenue_analytics
  FOR SELECT TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin users can view admin user activity" ON admin_user_activity
  FOR SELECT TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin users can view admin system health" ON admin_system_health
  FOR SELECT TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin users can view admin churn analysis" ON admin_churn_analysis
  FOR SELECT TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin users can view admin plan performance" ON admin_plan_performance
  FOR SELECT TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for admin action log
CREATE POLICY "Service role can manage admin action log" ON admin_action_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON admin_revenue_analytics TO service_role;
GRANT SELECT ON admin_user_activity TO service_role;
GRANT SELECT ON admin_system_health TO service_role;
GRANT SELECT ON admin_churn_analysis TO service_role;
GRANT SELECT ON admin_plan_performance TO service_role;
GRANT SELECT ON admin_action_log TO service_role;

-- Create admin user management functions
CREATE OR REPLACE FUNCTION admin_get_user_details(p_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz,
  last_sign_in timestamptz,
  subscription_status text,
  subscription_plan text,
  subscription_end_date timestamptz,
  total_conversions bigint,
  total_spent numeric(12,2),
  invoice_count integer,
  last_conversion_date timestamptz,
  churn_risk_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.created_at,
    p.last_sign_in,
    COALESCE(s.status, 'none') as subscription_status,
    COALESCE(sp.display_name, 'none') as subscription_plan,
    COALESCE(s.current_period_end, NULL) as subscription_end_date,
    COALESCE(ua.total_conversions, 0) as total_conversions,
    COALESCE(SUM(p.total_amount), 0) as total_spent,
    COUNT(i.id) as invoice_count,
    MAX(c.created_at) as last_conversion_date,
    -- Churn risk calculation (simplified)
    CASE
      WHEN COALESCE(s.status, 'none') = 'cancelled' THEN 100
      WHEN COALESCE(s.status, 'none') = 'past_due' THEN 80
      WHEN COALESCE(s.status, 'none') = 'paused' THEN 60
      WHEN COALESCE(s.status, 'none') = 'active' AND COALESCE(s.current_period_end, CURRENT_DATE) < CURRENT_DATE - INTERVAL '7 days' THEN 70
      WHEN COALESCE(s.status, 'none') = 'active' AND COALESCE(s.current_period_end, CURRENT_DATE) < CURRENT_DATE - INTERVAL '14 days' THEN 40
      WHEN COALESCE(s.status, 'none') = 'active' AND COALESCE(s.current_period_end, CURRENT_DATE) < CURRENT_DATE - INTERVAL '30 days' THEN 20
      ELSE 0
    END as churn_risk_score
  FROM profiles p
  LEFT JOIN subscriptions s ON p.id = s.user_id
  LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
  LEFT JOIN LATERAL (
    SELECT user_id, COUNT(*) as total_conversions, MAX(created_at) as last_conversion_date
    FROM conversions_history
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY user_id
  ) ua ON p.id = ua.user_id
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin revenue aggregation function
CREATE OR REPLACE FUNCTION admin_get_revenue_summary(p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL)
RETURNS TABLE(
  total_revenue numeric(12,2),
  total_invoices bigint,
  paid_invoices bigint,
  avg_invoice_amount numeric(12,2),
  new_customers integer,
  revenue_growth_rate numeric(5,2),
  top_revenue_plans jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(p.total_amount), 0) as total_revenue,
    COALESCE(COUNT(p.id), 0) as total_invoices,
    COALESCE(COUNT(CASE WHEN p.status = 'paid' THEN 1 END), 0) as paid_invoices,
    COALESCE(AVG(p.total_amount), 0) as avg_invoice_amount,
    COUNT(DISTINCT CASE WHEN s.created_at >= COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days') THEN s.user_id END) as new_customers,
    -- Revenue growth comparison (simplified)
    COALESCE(
      (SUM(p.total_amount) FILTER (WHERE p.created_at >= CURRENT_DATE - INTERVAL '30 days')) * 100.0 /
      NULLIF(SUM(p.total_amount) FILTER (WHERE p.created_at >= CURRENT_DATE - INTERVAL '60 days')), 0),
      0
    ) as revenue_growth_rate_percent,
    -- Top plans by revenue
    jsonb_build_object(
      CASE
        WHEN COUNT(p.id) > 0 THEN (
          jsonb_agg(
            jsonb_build_object(
              'plan_name', sp.display_name,
              'revenue', COALESCE(SUM(p.total_amount) FILTER (WHERE sp.id = s.plan_id), 0),
              'invoice_count', COUNT(p.id) FILTER (WHERE sp.id = s.plan_id)
            ) ORDER BY COALESCE(SUM(p.total_amount) FILTER (WHERE sp.id = s.plan_id), 0) DESC
          )
        )
        ELSE '{}'::jsonb
      END
    ) as top_revenue_plans
  FROM invoices p
  JOIN subscriptions s ON p.subscription_id = s.id
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE p.created_at >= COALESCE(p_start_date, CURRENT_DATE - INTERVAL '365 days')
    AND (p_end_date IS NULL OR p.created_at <= p_end_date)
    AND p.status = 'paid'
  AND p.created_at >= '2024-01-01';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for admin functions
GRANT EXECUTE ON FUNCTION admin_get_user_details TO service_role;
GRANT EXECUTE ON FUNCTION admin_get_revenue_summary TO service_role;