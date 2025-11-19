import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PaymentError, PaymentErrorType } from '../services/dodoPayments';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  pdf_limit: number | null;
  features: string[];
  sort_order: number;
  is_active: boolean;
}

interface CurrentSubscription {
  plan_name: string;
  plan_display_name: string;
  current_period_end: string;
}

interface PlanChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubscription: CurrentSubscription | null;
  availablePlans: SubscriptionPlan[];
  onPlanChangeRequested: (newPlanId: string, effectiveImmediately: boolean, reason: string) => void;
}

const PlanChangeModal: React.FC<PlanChangeModalProps> = ({
  isOpen,
  onClose,
  currentSubscription,
  availablePlans,
  onPlanChangeRequested,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [effectiveImmediately, setEffectiveImmediately] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [priceDifference, setPriceDifference] = useState<number>(0);

  const selectedPlan = availablePlans.find(plan => plan.id === selectedPlanId);
  const currentPlan = currentSubscription ?
    availablePlans.find(plan => plan.name === currentSubscription.plan_name) : null;

  useEffect(() => {
    if (selectedPlan && currentPlan) {
      const diff = selectedPlan.price_monthly - currentPlan.price_monthly;
      setPriceDifference(diff);
    }
  }, [selectedPlan, currentPlan, availablePlans]);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setSelectedPlanId('');
      setEffectiveImmediately(false);
      setReason('');
      setError(null);
      setPriceDifference(0);
    }
  }, [isOpen]);

  const calculateEffectiveDate = (immediate: boolean) => {
    if (!currentSubscription) return 'Unknown';

    if (immediate) {
      return 'Immediately';
    }

    return `On ${formatDate(currentSubscription.current_period_end)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlanId) {
      setError('Please select a plan');
      return;
    }

    if (!currentPlan || selectedPlanId === currentPlan.id) {
      setError('Please select a different plan');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the plan change');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to change your plan');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-management/change`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subscriptionId: currentSubscription.plan_name, // This would need to be the actual subscription ID
            newPlanId: selectedPlanId,
            effectiveImmediately,
            reason: reason.trim(),
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        onPlanChangeRequested(selectedPlanId, effectiveImmediately, reason.trim());
        onClose();
      } else {
        setError(result.error || 'Failed to change subscription plan');
      }
    } catch (err) {
      console.error('Plan change error:', err);
      if (err instanceof PaymentError) {
        setError(err.userMessage);
      } else {
        setError('Failed to change plan. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !currentSubscription) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 right-0 bg-white border-l border-t border-b border-gray-200 rounded-tr-lg p-4">
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 pt-16">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Change Subscription Plan</h2>
            <p className="text-gray-600">
              Choose a new plan and when you'd like the change to take effect.
            </p>
          </div>

          {/* Plan Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {availablePlans.map((plan) => {
              const isCurrentPlan = plan.id === currentPlan?.id;
              const isSelectedPlan = plan.id === selectedPlanId;

              return (
                <div
                  key={plan.id}
                  onClick={() => !isCurrentPlan && setSelectedPlanId(plan.id)}
                  className={`
                    relative rounded-lg border-2 p-6 cursor-pointer transition-all
                    ${isCurrentPlan
                      ? 'border-blue-500 bg-blue-50 cursor-not-allowed opacity-75'
                      : isSelectedPlan
                        ? 'border-green-500 bg-green-50 shadow-lg transform -translate-y-1'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }
                  `}
                >
                  {isCurrentPlan && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                      Current Plan
                    </div>
                  )}
                  {isSelectedPlan && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                      Selected
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.display_name}</h3>
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {formatCurrency(plan.price_monthly)}
                      <span className="text-sm text-gray-500 font-normal">/month</span>
                    </div>
                    {plan.pdf_limit !== null && (
                      <div className="text-sm text-gray-600">
                        {plan.pdf_limit.toLocaleString()} PDFs per month
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-gray-900 mb-2">Features:</h4>
                    <ul className="space-y-1">
                      {JSON.parse(plan.features).map((feature: string, index: number) => (
                        <li key={index} className="flex items-start text-sm text-gray-600">
                          <svg className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 00-1.414 0l-8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Effective Date Selection */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">When should this change take effect?</h3>
            <div className="space-y-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="effectiveDate"
                  checked={!effectiveImmediately}
                  onChange={() => setEffectiveImmediately(false)}
                  className="mr-3 h-4 w-4 text-blue-600"
                />
                <div>
                  <div className="font-medium text-gray-900">Next Billing Cycle</div>
                  <div className="text-sm text-gray-600">
                    Continue with current plan until {formatDate(currentSubscription.current_period_end)}, then switch to new plan
                  </div>
                </div>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="effectiveDate"
                  checked={effectiveImmediately}
                  onChange={() => setEffectiveImmediately(true)}
                  className="mr-3 h-4 w-4 text-blue-600"
                />
                <div>
                  <div className="font-medium text-gray-900">Immediately</div>
                  <div className="text-sm text-gray-600">
                    Switch to new plan right away and be charged the prorated difference
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Price Difference Summary */}
          {selectedPlan && currentPlan && priceDifference !== 0 && (
            <div className={`rounded-lg p-6 mb-6 ${
              priceDifference > 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {priceDifference > 0 ? 'Additional Cost' : 'Savings'}
              </h3>
              <div className="text-2xl font-bold mb-2">
                {priceDifference > 0 ? '+' : ''}
                {formatCurrency(Math.abs(priceDifference))}
                <span className="text-sm text-gray-500 font-normal">
                  {priceDifference > 0 ? ' extra charge' : ' saved'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {effectiveImmediately
                  ? `Charged immediately upon plan change confirmation`
                  : `Billed on ${formatDate(currentSubscription.current_period_end)}`
                }
              </div>
            </div>
          )}

          {/* Change Reason */}
          <div className="mb-6">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Change (Required)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Please let us know why you're changing your plan..."
              required
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 0116 0zm-1 8a1 1 0 002 0v-3a1 1 0 00-2 0v3a1 1 0 002 0zm-1 1a1 1 0 100-2 0v3a1 1 0 001 0v-3a1 1 0 102 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading || !selectedPlanId || !reason.trim()}
              className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8 8 0 018 8z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                `Change to ${selectedPlan?.display_name || 'New Plan'}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanChangeModal;