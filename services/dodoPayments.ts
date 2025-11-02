const DODO_API_KEY = import.meta.env.VITE_DODO_API_KEY;
const DODO_API_BASE = 'https://api.dodopayments.com/v1';

interface CheckoutSessionParams {
  planId: string;
  userId: string;
  userEmail: string;
  planName: string;
  amount: number;
  successUrl: string;
  cancelUrl: string;
}

export const createCheckoutSession = async (params: CheckoutSessionParams): Promise<string> => {
  try {
    const response = await fetch(`${DODO_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_email: params.userEmail,
        line_items: [
          {
            name: params.planName,
            amount: params.amount * 100,
            currency: 'USD',
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          plan_id: params.planId,
          user_id: params.userId,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create checkout session');
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Dodo Payments error:', error);
    throw error;
  }
};

export const isDodoPaymentsConfigured = (): boolean => {
  return !!DODO_API_KEY && DODO_API_KEY.length > 0;
};
