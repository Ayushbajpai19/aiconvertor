import React from 'react';

interface TabProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  isActive?: boolean;
  onClick?: () => void;
}

interface BillingNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  currentSubscription?: {
    status: string;
    plan_name: string;
    plan_display_name: string;
    pdf_limit?: number | null;
    days_remaining?: number;
  };
  usageStats?: {
    quota_used: number;
    quota_limit?: number | null;
    quota_percentage?: number;
  };
  pendingChanges?: {
    type: string;
    from_plan: string;
    to_plan: string;
    effective_date?: string;
  };
  pendingInvoices?: number;
  unpaidInvoices?: number;
}

const Tab: React.FC<TabProps> = ({ id, label, icon, count, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
        isActive
          ? 'bg-blue-600 text-white border-blue-500'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-gray-300'
      } transition-colors duration-200`}
    >
      {icon}
      <span className="ml-2">{label}</span>
      {count !== undefined && (
        <span className="ml-auto bg-gray-200 text-gray-800 text-xs font-bold px-2 py-1 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
};

const BillingNavigation: React.FC<BillingNavigationProps> = ({
  activeTab,
  onTabChange,
  currentSubscription,
  usageStats,
  pendingChanges,
  pendingInvoices = 0,
  unpaidInvoices = 0,
}) => {
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13h8V7a2 2 0 002-2h8a2 2 0 012 12v8a2 2 0 01-2H4a2 2 0 012-12V7a2 2 0 012 12h8a2 2 0 012 12z" />
        </svg>
      ),
    },
    {
      id: 'subscription',
      label: 'Subscription',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9a7 7 0 014 0M17 11a7 7 0 014 0m-2 4v7a7 7 0 014 0m0 7a7 7 0 014 0" />
        </svg>
      ),
    },
    {
      id: 'usage',
      label: 'Usage',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 012 2M9 5a4 4 0 008 0m0 9a7 7 0 016 0m9 17a2 2 0 014 0m-2-2v6a2 2 0 008 0m0 5a7 7 0 014 0" />
        </svg>
      ),
    },
    {
      id: 'invoices',
      label: 'Invoices',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2l16 13v7a2 2 0 014 0l-16 13-7a2 2 0 014 0l-16 13v7a2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19c1.414 0 4.414 0 4.414 1.414 1.414-4.414H4.586c0-3.657-3.235-3.235-3.235L5 3.657c0-1.657 1.657-3.235-3.235s-1.414 3.235-3.235h1.657c0.828 1.657-1.657-1.657l4.414-4.414c0-1.657 1.657-1.657-4.414-4.414 0-4.714-4.714z" />
        </svg>
      ),
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'past_due':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-lg">
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex lg:flex-col lg:w-64 bg-gray-800">
        <div className="flex items-center px-6 py-4">
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0">
              <img
                src="/logo.png"
                alt="AI Convertor"
                className="h-8 w-auto"
              />
            </div>
            <div className="flex-1">
              <div className="text-2xl font-bold leading-8 text-white">AI Convertor</div>
              <div className="text-sm text-gray-300">Billing & Analytics</div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              id={tab.id}
              label={tab.label}
              icon={tab.icon}
              isActive={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              count={
                tab.id === 'invoices' && pendingInvoices ? pendingInvoices :
                tab.id === 'invoices' && unpaidInvoices ? unpaidInvoices :
                undefined
              }
            />
          ))}
        </div>

        {/* User Info Card */}
        {currentSubscription && (
          <div className="px-6 py-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2">Current Plan</h3>
              <div className="text-sm text-gray-300">
                {currentSubscription.plan_display_name}
                {currentSubscription.pdf_limit && (
                  <span className="text-gray-400"> ({currentSubscription.pdf_limit} PDFs/month)</span>
                )}
              </div>
              <div className="mt-3">
                <div className="text-sm text-gray-400 mb-1">Days Remaining:</div>
                <div className="text-2xl font-bold text-white">{currentSubscription.days_remaining}</div>
              </div>
            </div>
          </div>
        )}

        {/* Usage Stats Card */}
        {usageStats && (
          <div className="px-6 py-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2">Usage This Month</h3>
              <div className="text-sm text-gray-300">
                {usageStats.quota_limit ? (
                  <>
                    <div className="text-gray-400 mb-1">{usageStats.quota_used}/{usageStats.quota_limit}</div>
                    <div className="mt-2 bg-gray-600 rounded-full h-2">
                      <div
                        className="h-2 bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(100, (usageStats.quota_percentage || 0))}%` }}
                      ></div>
                    </div>
                  </>
                ) : (
                  <div className="text-2xl font-bold text-white">{usageStats.quota_used}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Changes Card */}
        {pendingChanges && (
          <div className="px-6 py-4">
            <div className="bg-yellow-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-2">Pending Changes</h3>
              <div className="text-sm text-gray-300">
                <div className="mb-1">
                  {pendingChanges.type.charAt(0).toUpperCase() + pendingChanges.type.slice(1)}
                </div>
                <div>
                  From: <span className="text-white font-medium">{pendingChanges.from_plan}</span>
                </div>
                <div>
                  To: <span className="text-white font-medium">{pendingChanges.to_plan}</span>
                </div>
                <div className="text-gray-400 mt-1">
                  Effective: {new Date(pendingChanges.effective_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="px-6 py-4">
          <div className="space-y-3">
            <button
              onClick={() => onTabChange('subscription')}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.293 12.957l2.828-8.828h2.828v2.828l-2.828-8.828-5.657 5.657-5.657h8.486c-1.414-1.414-1.414-1.414-5.657-5.657L2.414 5.657-5.657l-2.828-8.828H10.293c-1.414-1.414-1.414-5.657-5.657 0 0-3.657 3.657z" />
              </svg>
              Manage Subscription
            </button>

            <button
              onClick={() => onTabChange('invoices')}
              className="w-full flex items-center justify-center px-4 py-3 bg-white text-blue-600 border border-blue-500 rounded-md hover:bg-gray-50 transition-colors"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2l16 13v7a2 2 0 014 0l-16 13-7a2 2 0 014 0l-16 13v7a2 2 0 014 0z" />
              </svg>
              View Invoices
            </button>

            <button
              onClick={() => onTabChange('analytics')}
              className="w-full flex items-center justify-center px-4 py-3 bg-white text-blue-600 border border-blue-500 rounded-md hover:bg-gray-50 transition-colors"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19c1.414 0 4.414 0 4.414 1.414 1.414-4.414H4.586c0-3.657-3.235-3.235L5 3.657c0-1.657 1.657-1.657l4.414-4.414c0-1.657 1.657-4.414 0-4.714-4.714z" />
              </svg>
              Usage Analytics
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="lg:hidden relative">
        <div className="bg-gray-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-2xl font-bold leading-8 text-white">AI Convertor</div>
            <button
              onClick={() => {
                const nav = document.getElementById('mobile-billing-nav');
                nav?.classList.toggle('hidden');
              }}
              className="text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 18a2 2 0 012 2M17 18a2 2 0 014 0m-2-2v6a2 2 0 008 0m2 2v6a2 2 0 008 0m2 4v6a2 2 0 008 0m2 4v4a2 2 0 014 0M17 18a2 2 0 014 0m-2-2v6a2 2 0 008 0m-6 6a2 2 0 008 0m2 6v6a2 2 0 008 0z" />
              </svg>
            </button>
          </div>

          {/* Mobile Tab Navigation */}
          <div id="mobile-billing-nav" className="space-y-1">
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                id={tab.id}
                label={tab.label}
                icon={tab.icon}
                isActive={activeTab === tab.id}
                onClick={() => {
                  onTabChange(tab.id);
                  document.getElementById('mobile-billing-nav')?.classList.add('hidden');
                }}
                count={
                  tab.id === 'invoices' && pendingInvoices ? pendingInvoices :
                  tab.id === 'invoices' && unpaidInvoices ? unpaidInvoices :
                  undefined
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingNavigation;