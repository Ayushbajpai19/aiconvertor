import React, { useState, useEffect } from 'react';
import { BillingNavigation } from '../components/BillingNavigation';

interface AdminDashboardProps {
  onNavigationRequested?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigationRequested }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'revenue' | 'churn' | 'performance'>('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-dashboard/health`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('sb_access_token')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const data = await response.json();

      console.log('Admin dashboard data loaded:', data);
      setLoading(false);

    } catch (err) {
      console.error('Admin dashboard error:', err);
      setError('Failed to load admin dashboard data');
    } finally {
      setLoading(false);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-red-800">Admin Dashboard Error</h3>
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Dashboard Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Comprehensive analytics and user management interface</p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <BillingNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Tab Content */}
          <div className="bg-white shadow-lg rounded-lg">
            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Summary Cards */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
                      <div className="text-sm text-gray-600">
                        All systems operational
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">523</div>
                          <div className="text-sm text-gray-600">Total Users</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-green-600">98.2%</div>
                          <div className="text-sm text-gray-600">Success Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-orange-600">1.8%</div>
                          <div className="text-sm text-gray-600">Error Rate</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue This Month</h3>
                      <div className="text-3xl font-bold text-blue-600">$12,453</div>
                      <div className="text-sm text-gray-600">+15.3% vs last month</div>
                      <div className="text-sm text-gray-600">Total Invoices: 48</div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Invoices</h3>
                      <div className="text-3xl font-bold text-green-600">32</div>
                      <div className="text-sm text-gray-600">Overdue: 5</div>
                      <div className="text-sm text-gray-600">Pending: 2</div>
                    </div>
                  </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Rate Today</h3>
                      <div className="text-3xl font-bold text-green-600">95.4%</div>
                      <div className="text-sm text-gray-600">Based on 145 conversions</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Management</h3>
                <p className="text-gray-600">Search, manage, and monitor user accounts</p>
              </div>
              {/* User list table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300"></div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">User ID</div>
                            <div className="text-sm text-gray-500">user_123</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300"></div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">Email</div>
                            <div className="text-sm text-gray-500">user@example.com</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex items-center rounded-full text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">Professional</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded-md border border-blue-500 transition-colors text-sm">
                          Manage
                        </button>
                      </td>
                    </tr>

                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300"></div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">User ID</div>
                            <div className="text-sm text-gray-500">user_124</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300"></div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">Email</div>
                            <div className="text-sm text-gray-500">user@banned.com</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex items-center rounded-full text-xs font-semibold rounded-full bg-red-100 text-red-800">Banned</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-500">Free</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded-md border border-blue-500 transition-colors text-sm">
                          Unban
                        </button>
                      </td>
                    </tr>

                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300"></div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">User ID</div>
                            <div className="text-sm text-gray-500">user_125</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300"></div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">Email</div>
                            <div className="text-sm text-gray-500">user@new.com</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex items-center rounded-full text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Paused</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-500">Enterprise</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded-md border border-blue-500 transition-colors text-sm">
                          Manage
                        </button>
                      </td>
                    </tr>

                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300"></div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">User ID</div>
                            <div className="text-sm text-gray-500">user_126</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-300"></div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">Email</div>
                            <div className="text-sm text-gray-500">user@cancelled.com</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex items-center rounded-full text-xs font-semibold rounded-full bg-orange-100 text-orange-800">Cancelled</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-500">Basic</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded-md border border-blue-500 transition-colors text-sm">
                          View Details
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
            </div>
          )}

          {activeTab === 'revenue' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Analytics</h3>
                <div className="text-gray-600 mb-4">Monthly revenue breakdowns and growth trends</div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Revenue Stats</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">$45.2k</div>
                    <div className="text-sm text-gray-600">Monthly MRR</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">$37.8k</div>
                    <div className="text-sm text-gray-600">Churn Rate</div>
                  </div>
                </div>
                </div>

                <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">$3.4k</div>
                    <div className="text-sm text-gray-600">Average Revenue</div>
                  </div>
                </div>
                </div>

                <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">$1.8k</div>
                    <div className="text-sm text-gray-600">Customer Lifetime Value</div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}
            </div>
          )}
          </div>
        </div>
      </div>
    );
  };
};

export default AdminDashboard;