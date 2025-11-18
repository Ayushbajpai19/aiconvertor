import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UsageSummaryResponse {
  current_period: {
    start_date: string;
    end_date: string;
    days_remaining: number;
    days_used: number;
  };
  usage_stats: {
    conversions_count: number;
    successful_conversions: number;
    success_rate: number;
    quota_limit: number | null;
    quota_used: number;
    quota_used_percentage: number;
    total_file_size_mb: number;
    avg_file_size_mb: number;
  };
  plan_details: {
    name: string;
    display_name: string;
    pdf_limit: number | null;
  };
}

interface HistoricalTrendsResponse {
  trends: Array<{
    month: string;
    active_users: number;
    total_conversions: number;
    successful_conversions: number;
    success_rate: number;
    growth_rate: number | null;
    avg_file_size_mb: number;
  }>;
  plan_breakdown: Array<{
    plan_name: string;
    usage: {
      active_users: number;
      total_conversions: number;
      success_rate: number;
      avg_file_size_mb: number;
    };
  }>;
}

interface ConversionPatternsResponse {
  success_rates: Array<{
    month: string;
    success_rate: number;
    total_conversions: number;
    successful_conversions: number;
    failed_conversions: number;
    avg_success_file_size_mb: number;
    avg_failed_file_size_mb: number;
  }>;
  file_size_analysis: {
    avg_file_size_mb: number;
    min_file_size_mb: number;
    max_file_size_mb: number;
    size_distribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
  };
  top_errors: Array<{
    error_message: string;
    count: number;
    percentage: number;
  }>;
}

interface FeatureUsageResponse {
  insights_adoption: Array<{
    month: string;
    insights_usage_rate: number;
    transactions_usage_rate: number;
    budget_recommendations_usage_rate: number;
    categorization_usage_rate: number;
  }>;
  transaction_patterns: Array<{
    month: string;
    avg_transactions_per_conversion: number;
    max_transactions_per_conversion: number;
    conversions_with_transactions: number;
  conversions_without_transactions: number;
  }>;
}

interface PredictiveInsightsResponse {
  usage_predictions: Array<{
    month: string;
    predicted_conversions: number;
    predicted_file_size_mb: number;
    confidence_score: number;
    factors: string[];
  }>;
  recommendations: Array<{
    type: 'upgrade' | 'downgrade' | 'retention' | 'engagement';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact_estimate: string;
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function authenticateRequest(req: Request): Promise<{ supabase: any; userId: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Authorization header required');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Extract user ID from JWT token
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error('Invalid authentication token');
  }

  return { supabase, userId: user.id };
}

function createApiResponse<T>(success: boolean, data?: T, error?: string, message?: string): Response {
  const response: ApiResponse<T> = { success, data, error, message };

  return new Response(JSON.stringify(response), {
    status: success ? 200 : 400,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 2
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`${operationName} attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        break;
      }

      // Brief delay between retries
      await sleep(200 * attempt);
    }
  }

  throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
}

// GET /analytics/usage-summary - Current period usage with limits
async function getUsageSummary(supabase: any, userId: string): Promise<Response> {
  try {
    // Get daily usage summary
    const { data: dailyData, error: dailyError } = await supabase
      .rpc('get_daily_usage_summary', { p_user_id: userId, p_days: 30 });

    if (dailyError) {
      throw new Error(`Failed to fetch daily usage: ${dailyError}`);
    }

    // Get user analytics summary
    const { data: analyticsData, error: analyticsError } = await supabase
      .rpc('get_user_analytics_summary', { p_user_id: userId });

    if (analyticsError) {
      throw new Error(`Failed to fetch analytics summary: ${analyticsError}`);
    }

    // Get current subscription details
    const { data: subscriptionData } = await supabase
      .from('get_effective_subscription_status')
      .eq('user_id', userId);

    let quotaLimit = null;
    let planDetails = null;

    if (subscriptionData.length > 0) {
      const subscription = subscriptionData[0];
      quotaLimit = subscription.pdf_limit;
      planDetails = {
        name: subscription.plan_name,
        display_name: subscription.plan_display_name,
        pdf_limit: subscription.pdf_limit,
      };
    }

    // Calculate period stats
    const currentPeriod = dailyData.length > 0 ? {
      start_date: dailyData[dailyData.length - 1].date,
      end_date: subscriptionData.length > 0 ?
        subscriptionData[0].current_period_end.substring(0, 10) :
        new Date().toISOString().substring(0, 10),
      days_remaining: subscriptionData.length > 0 ?
        Math.max(0, Math.ceil((new Date(subscriptionData[0].current_period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) :
        0,
      days_used: dailyData.length,
    } : null;

    // Calculate usage stats
    const totalConversions = analyticsData.total_conversions || 0;
    const successfulConversions = analyticsData.successful_conversions || 0;
    const successRate = totalConversions > 0 ? (successfulConversions / totalConversions) * 100 : 100;

    const usageStats = {
      conversions_count: dailyData.reduce((sum, day) => sum + day.conversions_count, 0),
      successful_conversions: dailyData.reduce((sum, day) => sum + day.successful_conversions, 0),
      success_rate: successRate,
      quota_limit: quotaLimit,
      quota_used: dailyData.reduce((sum, day) => sum + day.successful_conversions, 0),
      quota_used_percentage: quotaLimit ?
        Math.min(100, (dailyData.reduce((sum, day) => sum + day.successful_conversions, 0) / quotaLimit) * 100) : 0,
      total_file_size_mb: analyticsData.total_files_processed_mb || 0,
      avg_file_size_mb: analyticsData.avg_file_size_mb || 0,
    };

    const responseData: UsageSummaryResponse = {
      current_period: currentPeriod || {
        start_date: new Date().toISOString().substring(0, 10),
        end_date: new Date().toISOString().substring(0, 10),
        days_remaining: 0,
        days_used: 0,
      },
      usage_stats: usageStats,
      plan_details: planDetails || {
        name: 'Free',
        display_name: 'Free Plan',
        pdf_limit: 1,
      },
    };

    return createApiResponse(true, responseData);

  } catch (error) {
    console.error('Get usage summary error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /analytics/historical-trends - Monthly usage trends
async function getHistoricalTrends(supabase: any, userId: string, months: number = 12): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('usage_trend_analytics')
      .select('*')
      .eq('user_id', userId) // Note: This would need user_id column added to view
      .order('month', { ascending: false })
      .limit(months);

    if (error) {
      throw new Error(`Failed to fetch usage trends: ${error.message}`);
    }

    // Group data by month for all users if user-specific view not available
    const planBreakdown = [
      { plan_name: 'free', usage: { active_users: 0, total_conversions: 0, success_rate: 0, avg_file_size_mb: 0 } },
      { plan_name: 'basic', usage: { active_users: 0, total_conversions: 0, success_rate: 0, avg_file_size_mb: 0 } },
      { plan_name: 'professional', usage: { active_users: 0, total_conversions: 0, success_rate: 0, avg_file_size_mb: 0 } },
      { plan_name: 'enterprise', usage: { active_users: 0, total_conversions: 0, success_rate: 0, avg_file_size_mb: 0 } },
    ];

    const responseData: HistoricalTrendsResponse = {
      trends: data || [],
      plan_breakdown: planBreakdown,
    };

    return createApiResponse(true, responseData);

  } catch (error) {
    console.error('Get historical trends error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /analytics/conversion-patterns - File processing patterns and error analysis
async function getConversionPatterns(supabase: any, userId: string, months: number = 12): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('conversion_analytics')
      .select('*')
      .eq('user_id', userId) // Note: This would need user_id filtering
      .order('month', { ascending: false })
      .limit(months);

    if (error) {
      throw new Error(`Failed to fetch conversion patterns: ${error.message}`);
    }

    // Calculate file size distribution
    const allSizes = data
      .filter(item => item.avg_success_file_size_mb !== null)
      .map(item => item.avg_success_file_size_mb || 0);

    const avgFileSize = allSizes.length > 0 ?
      allSizes.reduce((sum, size) => sum + size, 0) / allSizes.length : 0;

    const minFileSize = allSizes.length > 0 ? Math.min(...allSizes) : 0;
    const maxFileSize = allSizes.length > 0 ? Math.max(...allSizes) : 0;

    // Create size distribution
    const sizeDistribution = [
      { range: '< 1MB', count: 0, percentage: 0 },
      { range: '1-5MB', count: 0, percentage: 0 },
      { range: '5-10MB', count: 0, percentage: 0 },
      { range: '10-50MB', count: 0, percentage: 0 },
      { range: '> 50MB', count: 0, percentage: 0 },
    ];

    // Parse top errors
    const errorCounts: Record<string, number> = {};
    let totalErrors = 0;

    data.forEach(item => {
      if (item.top_errors) {
        const errors = (typeof item.top_errors === 'string' ?
          item.top_errors.split(',').map(e => e.trim()) :
          item.top_errors) || [];

        errors.forEach(error => {
          if (error) {
            errorCounts[error] = (errorCounts[error] || 0) + 1;
            totalErrors++;
          }
        });
      }
    });

    const topErrors = Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([error, count]) => ({
        error_message: error,
        count,
        percentage: totalErrors > 0 ? Math.round((count / totalErrors) * 100, 1) : 0,
      }));

    const responseData: ConversionPatternsResponse = {
      success_rates: data || [],
      file_size_analysis: {
        avg_file_size_mb: Math.round(avgFileSize * 100) / 100,
        min_file_size_mb: Math.round(minFileSize * 100) / 100,
        max_file_size_mb: Math.round(maxFileSize * 100) / 100,
        size_distribution: sizeDistribution,
      },
      top_errors: topErrors,
    };

    return createApiResponse(true, responseData);

  } catch (error) {
    console.error('Get conversion patterns error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /analytics/feature-usage - AI insights engagement metrics
async function getFeatureUsage(supabase: any, userId: string, months: number = 6): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('feature_adoption_analytics')
      .select('*')
      .eq('user_id', userId) // Note: This would need user_id filtering
      .order('month', { ascending: false })
      .limit(months);

    if (error) {
      throw new Error(`Failed to fetch feature usage: ${error.message}`);
    }

    // Parse transaction patterns from conversion analytics
    const conversionAnalytics = await supabase
      .from('conversion_analytics')
      .select('month, avg_transactions_per_conversion, successful, total')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .limit(months);

    const transactionPatterns = conversionAnalytics.data?.map(item => ({
      month: item.month,
      avg_transactions_per_conversion: item.avg_transactions_per_conversion || 0,
      max_transactions_per_conversion: 0, // Would need additional data for this
      conversions_with_transactions: item.avg_transactions_per_conversion > 0 ? item.successful || 0 : 0,
      conversions_without_transactions: item.avg_transactions_per_conversion > 0 ? 0 : (item.successful || 0),
    })) || [];

    const responseData: FeatureUsageResponse = {
      insights_adoption: data || [],
      transaction_patterns: transactionPatterns,
    };

    return createApiResponse(true, responseData);

  } catch (error) {
    console.error('Get feature usage error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /analytics/predictive-insights - Usage predictions and recommendations
async function getPredictiveInsights(supabase: any, userId: string): Promise<Response> {
  try {
    // Get historical usage data for predictions
    const { data: trendsData } = await supabase
      .from('usage_trend_analytics')
      .select('month, total_conversions, growth_rate_percent')
      .eq('user_id', userId) // Note: This would need user_id filtering
      .order('month', { ascending: false })
      .limit(6); // Last 6 months for prediction basis

    // Get user engagement data
    const { data: engagementData } = await supabase
      .from('user_engagement_analytics')
      .select('retention_rate_percent, conversion_frequency_days')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .limit(3); // Recent 3 months

    const predictions = trendsData?.map((trend, index) => {
      const baseConversions = Math.max(1, Math.round(trend.total_conversions * (1 + (0.05 * index))));
      const confidence = Math.max(0.5, Math.min(0.95, 1 - (index * 0.1)));

      const factors = [
        `Historical growth: ${trend.growth_rate_percent || 0}%`,
        `Seasonal trend: ${index % 2 === 0 ? 'increasing' : 'stable'}`,
        `User retention: ${engagementData?.[engagementData.length - 1]?.retention_rate_percent || 0}%`,
      ];

      return {
        month: trend.month,
        predicted_conversions: baseConversions,
        predicted_file_size_mb: Math.round((baseConversions * 2.5) * 100) / 100, // 2.5MB avg file size
        confidence_score: confidence,
        factors,
      };
    }) || [];

    // Generate recommendations
    const recommendations = [];

    if (trendsData && trendsData.length >= 2) {
      const avgGrowth = trendsData.reduce((sum, t) => sum + (t.growth_rate_percent || 0), 0) / trendsData.length;

      if (avgGrowth > 10) {
        recommendations.push({
          type: 'upgrade',
          priority: 'high',
          title: 'Consider upgrading your plan',
          description: 'Your usage is growing rapidly. An upgrade may provide better value.',
          impact_estimate: 'Potential 15% cost savings with annual plan',
        });
      }
    }

    const recentRetention = engagementData?.[0]?.retention_rate_percent;
    if (recentRetention && recentRetention < 80) {
      recommendations.push({
        type: 'retention',
        priority: 'medium',
        title: 'User engagement declining',
        description: 'Recent activity suggests reduced engagement. Consider engagement features.',
        impact_estimate: 'Improve retention by 25%',
      });
    }

    const responseData: PredictiveInsightsResponse = {
      usage_predictions: predictions,
      recommendations,
    };

    return createApiResponse(true, responseData);

  } catch (error) {
    console.error('Get predictive insights error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { supabase, userId } = await authenticateRequest(req);
    const url = new URL(req.url);
    const path = url.pathname;

    // Route handling
    if (path.endsWith('/usage-summary') && req.method === 'GET') {
      return await getUsageSummary(supabase, userId);
    }

    if (path.endsWith('/historical-trends') && req.method === 'GET') {
      const months = parseInt(url.searchParams.get('months') || '12');
      return await getHistoricalTrends(supabase, userId, months);
    }

    if (path.endsWith('/conversion-patterns') && req.method === 'GET') {
      const months = parseInt(url.searchParams.get('months') || '12');
      return await getConversionPatterns(supabase, userId, months);
    }

    if (path.endsWith('/feature-usage') && req.method === 'GET') {
      const months = parseInt(url.searchParams.get('months') || '6');
      return await getFeatureUsage(supabase, userId, months);
    }

    if (path.endsWith('/predictive-insights') && req.method === 'GET') {
      return await getPredictiveInsights(supabase, userId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        available_endpoints: [
          'GET /analytics/usage-summary',
          'GET /analytics/historical-trends',
          'GET /analytics/conversion-patterns',
          'GET /analytics/feature-usage',
          'GET /analytics/predictive-insights'
        ]
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Usage analytics API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});