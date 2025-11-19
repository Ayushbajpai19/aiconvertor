import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PaymentError, PaymentErrorType } from '../services/dodoPayments';

interface Subscription {
  id: string;
  status: string;
  effective_status: string;
  plan_name: string;
  plan_display_name: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  paused_until?: string;
  pending_plan_id?: string;
  pending_plan_name?: string;
  change_effective_date?: string;
  can_change_plan: boolean;
  days_until_renewal: number;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  pdf_limit: number | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

interface PendingChange {
  type: string;
  effective_date: string;
  from_plan: string;
  to_plan: string;
}

interface AvailableActions {
  can_pause: boolean;
  can_resume: boolean;
  can_cancel: boolean;
  can_upgrade: boolean;
  can_downgrade: boolean;
}

interface SubscriptionManagementProps {
  onPlanChangeRequested?: () => void;
  onSubscriptionUpdated?: () => void;
}

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({
  onPlanChangeRequested,
  onSubscriptionUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange | null>(null);
  const [availableActions, setAvailableActions] = useState<AvailableActions>({
    can_pause: false,
    can_resume: false,
    can_cancel: false,
    can_upgrade: false,
    can_downgrade: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to manage your subscription');
      }

      // Fetch current subscription status
      const subscriptionResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-management/status`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!subscriptionResponse.ok) {
        const errorData = await subscriptionResponse.json();
        throw new Error(errorData.error || 'Failed to load subscription data');
      }

      const subscriptionData = await subscriptionResponse.json();
      setSubscription(subscriptionData.data.subscription);
      setPendingChanges(subscriptionData.data.pending_changes);
      setAvailableActions(subscriptionData.data.available_actions);

      // Fetch available plans
      const plansResponse = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (plansResponse.error) {
        throw new Error(plansResponse.error.message);
      }

      setAvailablePlans(plansResponse.data || []);

    } catch (err) {
      console.error('Failed to load subscription data:', err);
      if (err instanceof PaymentError) {
        setError(err.userMessage);
      } else {
        setError('Failed to load subscription information. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePauseSubscription = async (durationMonths: number) => {
    if (!subscription) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-management/pause`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriptionId: subscription.id,
            durationMonths,
            reason: 'User requested pause via subscription management'
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        await loadSubscriptionData(); // Refresh data
        if (onSubscriptionUpdated) {
          onSubscriptionUpdated();
        }
      } else {
        setError(result.error || 'Failed to pause subscription');
      }
    } catch (err) {
      console.error('Pause subscription error:', err);
      if (err instanceof PaymentError) {
        setError(err.userMessage);
      } else {
        setError('Failed to pause subscription. Please try again.');
      }
    }
  };

  const handleResumeSubscription = async () => {
    if (!subscription) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-management/resume`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriptionId: subscription.id,
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        await loadSubscriptionData(); // Refresh data
        if (onSubscriptionUpdated) {
          onSubscriptionUpdated();
        }
      } else {
        setError(result.error || 'Failed to resume subscription');
      }
    } catch (err) {
      console.error('Resume subscription error:', err);
      if (err instanceof PaymentError) {
        setError(err.userMessage);
      } else {
        setError('Failed to resume subscription. Please try again.');
      }
    }
  };

  const handleCancelSubscription = async (immediate: boolean = false) => {
    if (!subscription) return;

    const reason = prompt('Please tell us why you\'re cancelling (optional):');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-management/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriptionId: subscription.id,
            immediate,
            reason: reason || undefined,
            feedback: undefined,
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        await loadSubscriptionData(); // Refresh data
        if (onSubscriptionUpdated) {
          onSubscriptionUpdated();
        }
      } else {
        setError(result.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      console.error('Cancel subscription error:', err);
      if (err instanceof PaymentError) {
        setError(err.userMessage);
      } else {
        setError('Failed to cancel subscription. Please try again.');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'paused': return 'text-yellow-600';
      case 'cancelled': return 'text-red-600';
      case 'past_due': return 'text-red-600';
      case 'pending_change': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'paused': return 'Paused';
      case 'cancelled': return 'Cancelled';
      case 'past_due': return 'Payment Failed';
      case 'pending_change': return 'Pending Change';
      default: return status;
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
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-red-800">Error</h3>
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

  if (!subscription) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">No active subscription found.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-8">Subscription Management</h2>

      {/* Current Subscription Status */}
      <div className="bg-white shadow-lg rounded-lg border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Current Subscription</h3>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Plan</p>
                  <p className="text-xl font-bold text-gray-900">{subscription.plan_display_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className={`text-lg font-semibold ${getStatusColor(subscription.effective_status)}`}>
                    {getStatusText(subscription.effective_status)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Current Period</p>
                  <p className="text-lg text-gray-900">
                    {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                  </p>
                </div>
                {subscription.days_until_renewal !== null && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Days Until Renewal</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {subscription.days_until_renewal} days
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Pending Changes */}
            {pendingChanges && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">Pending Changes</h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-blue-700">Change Type:</span>
                    <span className="font-medium text-blue-900 ml-2">
                      {pendingChanges.type.charAt(0).toUpperCase() + pendingChanges.type.slice(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-blue-700">From:</span>
                    <span className="font-medium text-blue-900 ml-2">{pendingChanges.from_plan}</span>
                  </div>
                  <div>
                    <span className="text-sm text-blue-700">To:</span>
                    <span className="font-medium text-blue-900 ml-2">{pendingChanges.to_plan}</span>
                  </div>
                  <div>
                    <span className="text-sm text-blue-700">Effective Date:</span>
                    <span className="font-medium text-blue-900 ml-2">
                      {formatDate(pendingChanges.effective_date)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Available Actions */}
      <div className="bg-white shadow-lg rounded-lg border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Available Actions</h3>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableActions.can_pause && (
              <button
                onClick={() => {
                  const duration = prompt('Pause for how many months? (1-3)', '1');
                  const months = parseInt(duration || '1');
                  if ([1, 2, 3].includes(months)) {
                    handlePauseSubscription(months);
                  }
                }}
                className="bg-yellow-600 text-white px-4 py-3 rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Pause Subscription
              </button>
            )}

            {availableActions.can_resume && (
              <button
                onClick={handleResumeSubscription}
                className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                Resume Subscription
              </button>
            )}

            {availableActions.can_change_plan && (
              <button
                onClick={() => onPlanChangeRequested?.()}
                className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Change Plan
              </button>
            )}

            {availableActions.can_cancel && (
              <button
                onClick={() => handleCancelSubscription(false)}
                className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subscription History */}
      <SubscriptionHistory subscriptionId={subscription.id} />
    </div>
  );
};

// Subscription History Component (embedded for better organization)
const SubscriptionHistory: React.FC<{ subscriptionId: string }> = ({ subscriptionId }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [subscriptionId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-management/history?subscriptionId=${subscriptionId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load subscription history');
      }

      const data = await response.json();
      setHistory(data.data.changes || []);

    } catch (err) {
      console.error('Failed to load subscription history:', err);
      setError('Failed to load subscription history');
    } finally {
      setLoading(false);
    }
  };

  if (!history.length && !loading) {
    return null;
  }

  return (
    <div className="bg-white shadow-lg rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Subscription History</h3>
      </div>
      <div className="px-6 py-4">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : error ? (
          <div className="text-red-600 text-center py-4">
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((change) => (
              <div key={change.id} className="border-l-4 border-gray-300 pl-4 py-2">
                <div className="text-sm">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-gray-900 capitalize">
                      {change.change_type.replace('_', ' ')}
                    </span>
                    <span className="text-gray-500">
                      {change.created_at && ` - ${formatDate(change.created_at)}`}
                    </span>
                  </div>
                  {change.reason && (
                    <div className="text-gray-600">{change.reason}</div>
                  )}
                  {change.old_plan_name && change.new_plan_name && (
                    <div className="text-gray-700">
                      From {change.old_plan_name} → {change.new_plan_name}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionManagement;