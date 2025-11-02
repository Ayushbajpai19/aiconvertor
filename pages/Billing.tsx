import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { BackButton } from '../components/BackButton';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export const Billing: React.FC = () => {
  const { subscription, usage } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const plan = subscription?.plan;

  return (
    <div className="min-h-screen bg-gray-50 apple-gradient">
      <div className="max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="mt-2 text-gray-600">Manage your subscription and payment history</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Plan</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Plan</p>
                <p className="text-2xl font-bold text-gray-900">{plan?.display_name || 'Free'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Price</p>
                <p className="text-lg font-semibold text-gray-900">
                  ${plan?.price_monthly || 0}/month
                </p>
              </div>
              {subscription && (
                <div>
                  <p className="text-sm text-gray-600">Renewal Date</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDate(subscription.current_period_end)}
                  </p>
                </div>
              )}
              <Button onClick={() => navigate('/pricing')} variant="secondary" className="w-full mt-4">
                Change Plan
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage This Period</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Conversions Used</p>
                <p className="text-2xl font-bold text-gray-900">
                  {usage?.conversions_used || 0}
                  {plan?.pdf_limit && ` / ${plan.pdf_limit}`}
                </p>
              </div>
              {plan?.pdf_limit && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(((usage?.conversions_used || 0) / plan.pdf_limit) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {plan.pdf_limit - (usage?.conversions_used || 0)} conversions remaining
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Payment History</h2>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : payments.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No payment history yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${payment.amount.toFixed(2)} {payment.currency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            payment.status === 'succeeded'
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
