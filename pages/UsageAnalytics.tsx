import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LineChart } from '../components/analytics/UsageCharts';

interface UsageAnalyticsData {
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

interface HistoricalTrends {
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

interface ConversionPatterns {
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

const UsageAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<UsageAnalyticsData | null>(null);
  const [trends, setTrends] = useState<HistoricalTrends | null>(null);
  const [patterns, setPatterns] = useState<ConversionPatterns | null>(null);
  const [timeRange, setTimeRange] = useState<'30d' | '3m' | '6m' | '12m'>('30d');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'trends' | 'patterns'>('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  useEffect(() => {
    loadTrendsData();
  }, [timeRange]);

  useEffect(() => {
    loadPatternsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to view analytics');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/usage-analytics/usage-summary`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load usage analytics');
      }

      const data = await response.json();
      setAnalyticsData(data.data);

    } catch (err) {
      console.error('Failed to load analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTrendsData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const months = timeRange === '30d' ? 1 : timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/usage-analytics/historical-trends?months=${months}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load trends data');
      }

      const data = await response.json();
      setTrends(data.data);

    } catch (err) {
      console.error('Failed to load trends data:', err);
      setError('Failed to load trends data');
    }
  };

  const loadPatternsData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const months = timeRange === '30d' ? 1 : timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/usage-analytics/conversion-patterns?months=${months}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load patterns data');
      }

      const data = await response.json();
      setPatterns(data.data);

    } catch (err) {
      console.error('Failed to load patterns data:', err);
      setError('Failed to load patterns data');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatFileSize = (sizeMb: number) => {
    if (sizeMb < 1) {
      return `${Math.round(sizeMb * 1024)} KB`;
    } else {
      return `${sizeMb.toFixed(1)} MB`;
    }
  };

  const getQuotaColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '30d': return 'Last 30 Days';
      case '3m': return 'Last 3 Months';
      case '6m': return 'Last 6 Months';
      case '12m': return 'Last 12 Months';
      default: return 'Select Range';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-red-800">Analytics Error</h3>
              <p className="mt-2 text-red-700">{error}</p>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Usage Analytics</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive insights into your PDF conversion usage patterns and performance metrics.
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="bg-white shadow-lg rounded-lg border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Time Range</h2>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="30d">Last 30 Days</option>
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="12m">Last 12 Months</option>
            </select>
          </div>
        </div>
        <div className="px-4 py-2 text-center text-sm text-gray-600">
          Showing data for {getTimeRangeLabel()}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow-lg rounded-lg border border-gray-200 mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Analytics tabs">
            <button
              onClick={() => setSelectedTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setSelectedTab('trends')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'trends'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Historical Trends
            </button>
            <button
              onClick={() => setSelectedTab('patterns')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'patterns'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Conversion Patterns
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {selectedTab === 'overview' && analyticsData && (
          <div className="space-y-8">
            {/* Current Period Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Period</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Days Used:</span>
                    <span className="text-2xl font-bold text-blue-600">{analyticsData.current_period.days_used}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Days Remaining:</span>
                    <span className={`text-2xl font-bold ${analyticsData.usage_stats.quota_used_percentage >= 90 ? 'text-red-600' : 'text-green-600'}`}>
                      {analyticsData.current_period.days_remaining}
                    </span>
                  </div>
                </div>
              </div>

              {/* Usage Statistics */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Conversions:</span>
                    <span className="text-2xl font-bold text-blue-600">{analyticsData.usage_stats.conversions_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Success Rate:</span>
                    <span className={`text-2xl font-bold ${getSuccessRateColor(analyticsData.usage_stats.success_rate)}`}>
                      {analyticsData.usage_stats.success_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Average File Size:</span>
                    <span className="text-xl font-bold text-blue-600">{formatFileSize(analyticsData.usage_stats.avg_file_size_mb)}</span>
                  </div>
                </div>
              </div>

              {/* Quota Usage */}
              {analyticsData.usage_stats.quota_limit && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quota Usage</h3>
                  <div className="space-y-3">
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">Quota Used:</span>
                        <span className={`text-2xl font-bold ${getQuotaColor(analyticsData.usage_stats.quota_used_percentage)}`}>
                          {analyticsData.usage_stats.quota_used}/{analyticsData.usage_stats.quota_limit}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div
                          className="h-4 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, analyticsData.usage_stats.quota_used_percentage)}%`,
                            backgroundColor: analyticsData.usage_stats.quota_used_percentage >= 90 ? '#dc2626' :
                                           analyticsData.usage_stats.quota_used_percentage >= 75 ? '#f59e0b' : '#10b981'
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {analyticsData.usage_stats.quota_used_percentage.toFixed(1)}% of quota used
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'trends' && trends && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Usage Trends Over Time</h3>
              <div className="h-96">
                <LineChart
                  data={trends.trends.map(trend => ({
                    name: 'Total Conversions',
                    value: trend.total_conversions,
                    date: trend.month,
                  }))}
                  xDataKey="date"
                  yDataKey="value"
                  color="#3b82f6"
                />
              </div>
            </div>

            <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Plan Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {trends.plan_breakdown.map((plan, index) => (
                  <div key={plan.plan_name} className="border-l-4 border-gray-300 pl-4">
                    <h4 className="font-semibold text-gray-900 mb-3">{plan.plan_name.toUpperCase()}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Active Users:</span>
                        <span className="font-bold">{plan.usage.active_users}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Conversions:</span>
                        <span className="font-bold">{plan.usage.total_conversions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Success Rate:</span>
                        <span className={`font-bold ${getSuccessRateColor(plan.usage.success_rate)}`}>
                          {plan.usage.success_rate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'patterns' && patterns && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Success Rates */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Success Rate Trends</h3>
                <div className="h-64">
                  <LineChart
                    data={patterns.success_rates.map(rate => ({
                      name: 'Success Rate %',
                      value: rate.success_rate,
                      date: rate.month,
                    }))}
                    xDataKey="date"
                    yDataKey="value"
                    color="#10b981"
                  />
                </div>
              </div>

              {/* File Size Analysis */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">File Size Analysis</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-gray-600">Average</p>
                      <p className="text-xl font-bold">{formatFileSize(patterns.file_size_analysis.avg_file_size_mb)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Minimum</p>
                      <p className="text-xl font-bold">{formatFileSize(patterns.file_size_analysis.min_file_size_mb)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Maximum</p>
                      <p className="text-xl font-bold">{formatFileSize(patterns.file_size_analysis.max_file_size_mb)}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Size Distribution</h4>
                    <div className="space-y-2">
                      {patterns.file_size_analysis.size_distribution.map((size) => (
                        <div key={size.range} className="flex items-center justify-between">
                          <span className="text-gray-600">{size.range}:</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-32 bg-gray-200 rounded-full h-4">
                              <div
                                className="h-4 rounded-full bg-blue-600"
                                style={{ width: `${size.percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-bold">{size.count} ({size.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Errors */}
              {patterns.top_errors.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 lg:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Common Errors</h3>
                  <div className="space-y-3">
                    {patterns.top_errors.map((error, index) => (
                      <div key={index} className="flex items-start justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800">{error.error_message}</p>
                          <p className="text-xs text-red-600 mt-1">{error.count} occurrences ({error.percentage}%)</p>
                        </div>
                        <div className="text-lg font-bold text-red-600">{error.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsageAnalytics;