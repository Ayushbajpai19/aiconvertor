import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { SubscriptionPlan } from '../lib/auth-types';

export const Checkout: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (planId) {
      fetchPlan();
    }
  }, [planId]);

  const fetchPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;
      setPlan(data);
    } catch (error) {
      console.error('Error fetching plan:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 apple-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 apple-gradient flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Plan not found</h2>
          <button
            onClick={() => navigate('/pricing')}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Return to pricing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 apple-gradient">
      <div className="max-w-2xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1>
          <p className="text-gray-600 mb-8">Complete your subscription to {plan.display_name}</p>

          <div className="border-t border-b border-gray-200 py-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{plan.display_name} Plan</h3>
                <p className="text-sm text-gray-600">
                  {plan.pdf_limit ? `${plan.pdf_limit} PDFs per month` : 'Unlimited PDFs'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">${plan.price_monthly}</div>
                <div className="text-sm text-gray-600">per month</div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Dodo Payments Integration</h3>
            <p className="text-sm text-blue-800 mb-4">
              To complete your subscription, you'll need to set up Dodo Payments integration.
              This requires API keys from your Dodo Payments account.
            </p>
            <a
              href="https://bolt.new/setup/stripe"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Setup Payment Integration
            </a>
          </div>

          <div className="text-sm text-gray-600">
            <p className="mb-2">By continuing, you agree to our Terms & Conditions and Refund Policy.</p>
            <p>Your subscription will automatically renew monthly until cancelled.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
