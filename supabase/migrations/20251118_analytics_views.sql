/*
  # Phase 3: Analytics Database Views and Functions

  ## Overview
  Create optimized analytics infrastructure with materialized views for fast queries and comprehensive usage tracking.

  ## Changes

  ### 1. Materialized Views for Performance
  - Monthly usage aggregations with automatic refresh
  - Usage trend calculations with month-over-month comparisons
  - Conversion success rate metrics
  - Feature engagement tracking

  ### 2. Analytics Functions
  - Automated view refresh functions
  - Usage calculation functions
  - Analytics aggregation helpers

  ### 3. Performance Optimizations
  - Proper indexing for analytics queries
  - Partitioned view strategies
  - Efficient aggregation functions
*/

-- Create materialized view for monthly usage aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_usage_analytics AS
SELECT
  DATE_TRUNC('month', c.created_at) as month,
  COUNT(DISTINCT c.user_id) as active_users,
  COUNT(c.id) as total_conversions,
  COUNT(CASE WHEN c.status = 'success' THEN 1 END) as successful_conversions,
  ROUND(COUNT(CASE WHEN c.status = 'success' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as success_rate_percent,
  SUM(CASE WHEN c.status = 'success' THEN c.file_size ELSE 0 END) as total_file_size_bytes,
  ROUND(AVG(CASE WHEN c.status = 'success' THEN c.file_size ELSE NULL END) / 1024.0 / 1024.0, 2) as avg_file_size_mb,
  SUM(CASE WHEN c.status = 'success' THEN c.transaction_count ELSE 0 END) as total_transactions,
  ROUND(AVG(CASE WHEN c.status = 'success' THEN c.transaction_count ELSE NULL END), 2) as avg_transactions_per_file,
  MIN(CASE WHEN c.status = 'success' THEN c.file_size ELSE NULL END) as min_file_size_bytes,
  MAX(CASE WHEN c.status = 'success' THEN c.file_size ELSE NULL END) as max_file_size_bytes,
  -- Usage by plan tier
  COUNT(DISTINCT CASE WHEN sp.name = 'free' THEN c.user_id END) as free_users,
  COUNT(DISTINCT CASE WHEN sp.name = 'basic' THEN c.user_id END) as basic_users,
  COUNT(DISTINCT CASE WHEN sp.name = 'professional' THEN c.user_id END) as professional_users,
  COUNT(DISTINCT CASE WHEN sp.name = 'enterprise' THEN c.user_id END) as enterprise_users
FROM conversions_history c
JOIN subscriptions s ON c.user_id = s.user_id
  AND c.created_at >= s.current_period_start
  AND c.created_at < s.current_period_end
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE c.created_at >= '2024-01-01' -- Start tracking from launch
  AND c.status IN ('success', 'failed')
GROUP BY DATE_TRUNC('month', c.created_at);

-- Create unique index for faster refreshing
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_usage_analytics_month
ON monthly_usage_analytics(month);

-- Create materialized view for usage trends with month-over-month comparison
CREATE MATERIALIZED VIEW IF NOT EXISTS usage_trend_analytics AS
WITH monthly_data AS (
  SELECT
    DATE_TRUNC('month', c.created_at) as month,
    sp.name as plan_name,
    COUNT(DISTINCT c.user_id) as active_users,
    COUNT(c.id) as total_conversions,
    COUNT(CASE WHEN c.status = 'success' THEN 1 END) as successful_conversions,
    ROUND(COUNT(CASE WHEN c.status = 'success' THEN 1 END) * 100.0 / NULLIF(COUNT(c.id), 0), 2) as success_rate_percent,
    ROUND(AVG(c.file_size) / 1024.0 / 1024.0, 2) as avg_file_size_mb
  FROM conversions_history c
  JOIN subscriptions s ON c.user_id = s.user_id
    AND c.created_at >= s.current_period_start
    AND c.created_at < s.current_period_end
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE c.created_at >= '2024-01-01'
    AND c.status IN ('success', 'failed')
  GROUP BY DATE_TRUNC('month', c.created_at), sp.name
)
SELECT
  current.month,
  current.plan_name,
  current.active_users,
  current.total_conversions,
  current.successful_conversions,
  current.success_rate_percent,
  current.avg_file_size_mb,
  COALESCE(previous.total_conversions, 0) as prev_conversions,
  COALESCE(previous.successful_conversions, 0) as prev_successful,
  COALESCE(previous.success_rate_percent, 0) as prev_success_rate,
  CASE
    WHEN previous.total_conversions IS NULL THEN 0
    WHEN previous.total_conversions = 0 THEN NULL
    ELSE ROUND((current.total_conversions - previous.total_conversions) * 100.0 / previous.total_conversions, 2)
  END as growth_rate_percent
FROM monthly_data current
LEFT JOIN LATERAL (
  SELECT * FROM monthly_usage_analytics prev
  WHERE prev.month = (current.month - INTERVAL '1 month')
  LIMIT 1
) previous ON true;

-- Create unique index for trend view
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_trend_analytics_month_plan
ON usage_trend_analytics(month, plan_name);

-- Create materialized view for conversion success rates
CREATE MATERIALIZED VIEW IF NOT EXISTS conversion_analytics AS
SELECT
  DATE_TRUNC('month', c.created_at) as month,
  sp.name as plan_name,
  COUNT(CASE WHEN c.status = 'success' THEN 1 END) as successful,
  COUNT(CASE WHEN c.status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN c.status = 'processing' THEN 1 END) as processing,
  COUNT(*) as total,
  ROUND(COUNT(CASE WHEN c.status = 'success' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as success_rate,
  -- File size success correlation
  ROUND(AVG(CASE WHEN c.status = 'success' THEN c.file_size ELSE NULL END) / 1024.0 / 1024.0, 2) as avg_success_file_size_mb,
  ROUND(AVG(CASE WHEN c.status = 'failed' THEN c.file_size ELSE NULL END) / 1024.0 / 1024.0, 2) as avg_failed_file_size_mb,
  -- Error analysis
  STRING_AGG(DISTINCT c.error_message, ', ' ORDER BY c.error_message LIMIT 10') as top_errors,
  -- Processing time analysis
  ROUND(AVG(EXTRACT(EPOCH FROM (c.updated_at - c.created_at))) as avg_processing_time_seconds
FROM conversions_history c
JOIN subscriptions s ON c.user_id = s.user_id
  AND c.created_at >= s.current_period_start
  AND c.created_at < s.current_period_end
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE c.created_at >= '2024-01-01'
GROUP BY DATE_TRUNC('month', c.created_at), sp.name;

-- Create index for conversion analytics
CREATE INDEX IF NOT EXISTS idx_conversion_analytics_month_plan
ON conversion_analytics(month, plan_name);

-- Create materialized view for user engagement metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS user_engagement_analytics AS
SELECT
  DATE_TRUNC('month', c.created_at) as month,
  COUNT(DISTINCT c.user_id) as active_users,
  COUNT(CASE WHEN c.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN c.user_id END) as weekly_active_users,
  COUNT(DISTINCT CASE WHEN c.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN c.user_id END) as monthly_active_users,
  -- User retention metrics
  COUNT(DISTINCT CASE
    WHEN EXISTS (
      SELECT 1 FROM conversions_history c_prev
      WHERE c_prev.user_id = c.user_id
      AND c_prev.created_at < DATE_TRUNC('month', c.created_at) - INTERVAL '1 month'
    ) THEN c.user_id
  END) as returning_users,
  ROUND(COUNT(DISTINCT CASE
    WHEN EXISTS (
      SELECT 1 FROM conversions_history c_prev
      WHERE c_prev.user_id = c.user_id
      AND c_prev.created_at < DATE_TRUNC('month', c.created_at) - INTERVAL '1 month'
    ) THEN c.user_id
  END) * 100.0 / NULLIF(COUNT(DISTINCT c.user_id), 0), 2) as retention_rate_percent,
  -- Conversion frequency
  AVG(user_conversion_count.conversions_per_user) as avg_conversions_per_active_user,
  MAX(user_conversion_count.conversions_per_user) as max_conversions_per_user
FROM conversions_history c
LEFT JOIN LATERAL (
  SELECT c_inner.user_id, COUNT(*) as conversions_per_user
  FROM conversions_history c_inner
  WHERE c_inner.user_id = c.user_id
    AND c_inner.created_at >= DATE_TRUNC('month', c.created_at)
    AND c_inner.created_at < DATE_TRUNC('month', c.created_at) + INTERVAL '1 month'
    AND c_inner.status = 'success'
  GROUP BY c_inner.user_id
) user_conversion_count ON true
WHERE c.created_at >= '2024-01-01'
  AND c.status = 'success'
GROUP BY DATE_TRUNC('month', c.created_at);

-- Create index for user engagement analytics
CREATE INDEX IF NOT EXISTS idx_user_engagement_analytics_month
ON user_engagement_analytics(month);

-- Create materialized view for feature adoption metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS feature_adoption_analytics AS
SELECT
  DATE_TRUNC('month', c.created_at) as month,
  sp.name as plan_name,
  COUNT(CASE WHEN c.insights IS NOT NULL THEN 1 END) as conversions_with_insights,
  ROUND(COUNT(CASE WHEN c.insights IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as insights_usage_rate,
  COUNT(CASE WHEN c.transaction_count > 0 THEN 1 END) as conversions_with_transactions,
  ROUND(AVG(c.transaction_count), 2) as avg_transactions_per_conversion,
  -- Feature usage based on insights
  COUNT(CASE WHEN c.insights->>'spending_analysis' IS NOT NULL THEN 1 END) as spending_analysis_usage,
  COUNT(CASE WHEN c.insights->>'recurring_transactions' IS NOT NULL THEN 1 END) as recurring_transactions_usage,
  COUNT(CASE WHEN c.insights->>'budget_recommendations' IS NOT NULL THEN 1 END) as budget_recommendations_usage,
  COUNT(CASE WHEN c.insights->>'categorization' IS NOT NULL THEN 1 END) as categorization_usage
FROM conversions_history c
JOIN subscriptions s ON c.user_id = s.user_id
  AND c.created_at >= s.current_period_start
  AND c.created_at < s.current_period_end
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE c.created_at >= '2024-01-01'
  AND c.status = 'success'
GROUP BY DATE_TRUNC('month', c.created_at), sp.name;

-- Create index for feature adoption analytics
CREATE INDEX IF NOT EXISTS idx_feature_adoption_month_plan
ON feature_adoption_analytics(month, plan_name);

-- Create function to refresh all analytics materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS TABLE(
  view_name text,
  refresh_status text,
  rows_refreshed bigint,
  refresh_duration_ms integer,
  refresh_timestamp timestamptz
) AS $$
DECLARE
  v_start_time timestamptz := clock_timestamp();
  v_result jsonb := '{}'::jsonb;
  v_views text[] := ARRAY[
    'monthly_usage_analytics',
    'usage_trend_analytics',
    'conversion_analytics',
    'user_engagement_analytics',
    'feature_adoption_analytics'
  ];
BEGIN
  -- Refresh each materialized view and track results
  FOREACH view_name IN ARRAY v_views
  LOOP
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);

    v_result := jsonb_set(
      v_result,
      view_name,
      jsonb_build_object(
        'status', 'success',
        'timestamp', clock_timestamp()
      )
    );
  END LOOP;

  -- Return results as table rows
  RETURN QUERY
  SELECT
    unnest(v_result) as (view_name text, result jsonb),
    EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start_time)) as refresh_duration_ms,
    clock_timestamp() as refresh_timestamp;
END;
$$ LANGUAGE plpgsql;

-- Create function for daily usage calculations
CREATE OR REPLACE FUNCTION get_daily_usage_summary(p_user_id uuid, p_days integer DEFAULT 30)
RETURNS TABLE(
  date date,
  conversions_count integer,
  successful_conversions integer,
  files_processed_mb numeric,
  avg_file_size_mb numeric,
  quota_used_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.created_at::date as date,
    COUNT(*) as conversions_count,
    COUNT(CASE WHEN c.status = 'success' THEN 1 END) as successful_conversions,
    ROUND(SUM(CASE WHEN c.status = 'success' THEN c.file_size ELSE 0 END) / 1024.0 / 1024.0, 2) as files_processed_mb,
    ROUND(AVG(CASE WHEN c.status = 'success' THEN c.file_size ELSE NULL END) / 1024.0 / 1024.0, 2) as avg_file_size_mb,
    CASE
      WHEN sp.pdf_limit IS NULL THEN NULL -- Unlimited
      WHEN sp.pdf_limit = 0 THEN NULL -- Free tier (1 PDF total)
      ELSE ROUND(
        COUNT(CASE WHEN c.status = 'success' THEN 1 END) * 100.0 / sp.pdf_limit, 2
      )
    END as quota_used_percentage
  FROM conversions_history c
  JOIN subscriptions s ON c.user_id = s.user_id
    AND c.created_at >= s.current_period_start
    AND c.created_at < s.current_period_end
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE c.user_id = p_user_id
    AND c.created_at >= CURRENT_DATE - INTERVAL '%s days', p_days)
    AND c.status IN ('success', 'failed')
  GROUP BY c.created_at::date, sp.pdf_limit
  ORDER BY c.created_at::date DESC
  LIMIT p_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for user analytics summary
CREATE OR REPLACE FUNCTION get_user_analytics_summary(p_user_id uuid)
RETURNS TABLE(
  total_conversions bigint,
  successful_conversions bigint,
  success_rate numeric,
  total_files_processed_mb numeric,
  avg_file_size_mb numeric,
  most_used_feature text,
  last_conversion_date timestamptz,
  conversion_frequency_days numeric
) AS $$
DECLARE
  v_total_days integer;
BEGIN
  RETURN QUERY
  WITH user_stats AS (
    SELECT
      COUNT(*) as total_conversions,
      COUNT(CASE WHEN c.status = 'success' THEN 1 END) as successful_conversions,
      ROUND(COUNT(CASE WHEN c.status = 'success' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as success_rate,
      ROUND(SUM(CASE WHEN c.status = 'success' THEN c.file_size ELSE 0 END) / 1024.0 / 1024.0, 2) as total_files_processed_mb,
      ROUND(AVG(CASE WHEN c.status = 'success' THEN c.file_size ELSE NULL END) / 1024.0 / 1024.0, 2) as avg_file_size_mb,
      MAX(c.created_at) as last_conversion_date
    FROM conversions_history c
    WHERE c.user_id = p_user_id
      AND c.status IN ('success', 'failed')
  ),
  feature_usage AS (
    SELECT
      COUNT(CASE WHEN c.insights->>'spending_analysis' IS NOT NULL THEN 1 END) as spending_analysis_count,
      COUNT(CASE WHEN c.insights->>'recurring_transactions' IS NOT NULL THEN 1 END) as recurring_transactions_count,
      COUNT(CASE WHEN c.insights->>'budget_recommendations' IS NOT NULL THEN 1 END) as budget_recommendations_count
    FROM conversions_history c
    WHERE c.user_id = p_user_id
      AND c.insights IS NOT NULL
  )
  SELECT
    us.total_conversions,
    us.successful_conversions,
    us.success_rate,
    us.total_files_processed_mb,
    us.avg_file_size_mb,
    us.last_conversion_date,
    CASE
      WHEN fu.spending_analysis_count >= fu.recurring_transactions_count AND fu.spending_analysis_count >= fu.budget_recommendations_count THEN 'Spending Analysis'
      WHEN fu.recurring_transactions_count >= fu.budget_recommendations_count THEN 'Recurring Transactions'
      WHEN fu.budget_recommendations_count > 0 THEN 'Budget Recommendations'
      ELSE 'Transaction Processing'
    END as most_used_feature,
    EXTRACT(DAY FROM (MAX(us.last_conversion_date) - MIN(us.last_conversion_date))) as conversion_frequency_days
  FROM user_stats us, feature_usage fu;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security for analytics views
ALTER TABLE monthly_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_trend_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_engagement_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_adoption_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analytics (read-only for authenticated users)
CREATE POLICY "Authenticated users can view analytics" ON monthly_usage_analytics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view analytics" ON usage_trend_analytics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view analytics" ON conversion_analytics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view analytics" ON user_engagement_analytics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view analytics" ON feature_adoption_analytics
  FOR SELECT TO authenticated USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT ON monthly_usage_analytics TO authenticated;
GRANT SELECT ON usage_trend_analytics TO authenticated;
GRANT SELECT ON conversion_analytics TO authenticated;
GRANT SELECT ON user_engagement_analytics TO authenticated;
GRANT SELECT ON feature_adoption_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_analytics_views TO service_role;
GRANT EXECUTE ON FUNCTION get_daily_usage_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_analytics_summary TO authenticated;

-- Create scheduled job to refresh analytics views daily
-- Note: This would typically be set up via cron job or pg_cron extension
SELECT pg_cron.schedule(
  '0 2 * * *', -- Daily at 2 AM
  $$SELECT refresh_analytics_views();$$,
  active => true,
  job_name => 'refresh_analytics_views'
);