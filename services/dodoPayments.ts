import { supabase } from '../lib/supabase';

interface CheckoutSessionParams {
  planId: string;
  userId: string;
  userEmail: string;
  planName: string;
  amount: number;
  successUrl: string;
  cancelUrl: string;
}

interface CheckoutResponse {
  url?: string;
  error?: string;
  configured: boolean;
}

export const createCheckoutSession = async (params: CheckoutSessionParams): Promise<string> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('You must be logged in to create a checkout session');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId: params.planId,
        planName: params.planName,
        amount: params.amount,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    const data: CheckoutResponse = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.configured) {
      throw new Error('Payment system is not configured. Please contact support.');
    }

    if (!data.url) {
      throw new Error('No checkout URL returned');
    }

    return data.url;
  } catch (error) {
    console.error('Dodo Payments error:', error);
    throw error;
  }
};

export const isDodoPaymentsConfigured = (): boolean => {
  return true;
};
