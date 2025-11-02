import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionPlan } from '../lib/auth-types';
import { Button } from '../components/Button';
import { BackButton } from '../components/BackButton';

export const Pricing: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, subscription } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (!user) {
      navigate('/register');
      return;
    }

    if (plan.name === 'free') {
      return;
    }

    navigate(`/checkout/${plan.id}`);
  };

  const isCurrentPlan = (planId: string) => {
    return subscription?.plan_id === planId;
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

  return (
    <div className="min-h-screen bg-gray-50 apple-gradient">
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <BackButton />
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Start with our free tier or upgrade to unlock more conversions and advanced features
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => {
            const features = Array.isArray(plan.features) ? plan.features : [];
            const isCurrent = isCurrentPlan(plan.id);
            const isFree = plan.name === 'free';
            const isEnterprise = plan.name === 'enterprise';

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl shadow-sm p-8 flex flex-col ${
                  plan.name === 'professional' ? 'ring-2 ring-blue-600 relative' : ''
                }`}
              >
                {plan.name === 'professional' && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.display_name}
                  </h3>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">
                      ${plan.price_monthly}
                    </span>
                    <span className="text-gray-600 ml-2">/month</span>
                  </div>
                  {plan.pdf_limit && (
                    <p className="mt-2 text-sm text-gray-600">
                      {plan.pdf_limit} PDFs per month
                    </p>
                  )}
                  {!plan.pdf_limit && !isFree && (
                    <p className="mt-2 text-sm text-gray-600">
                      Unlimited PDFs
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-600 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelectPlan(plan)}
                  variant={plan.name === 'professional' ? 'primary' : 'secondary'}
                  disabled={isCurrent || isFree}
                  className="w-full"
                >
                  {isCurrent
                    ? 'Current Plan'
                    : isFree
                    ? 'Free Forever'
                    : isEnterprise
                    ? 'Contact Sales'
                    : 'Get Started'}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-gray-600">
            All plans include secure processing, data encryption, and CSV export.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Have questions?{' '}
            <a href="/contact" className="text-blue-600 hover:text-blue-700 font-medium">
              Contact our team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
