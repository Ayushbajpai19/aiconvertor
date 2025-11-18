import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DODO_API_KEY = Deno.env.get('DODO_API_KEY');
const DODO_WEBHOOK_SECRET = Deno.env.get('DODO_WEBHOOK_SECRET');
const DODO_API_BASE = 'https://live.dodopayments.com';

interface CheckoutRequest {
  planId: string;
  successUrl: string;
  cancelUrl: string;
  customerInfo?: {
    name?: string;
    phone_number?: string;
    billing_address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      zipcode?: string;
    };
  };
  metadata?: Record<string, string>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { planId, successUrl, cancelUrl, customerInfo = {}, metadata = {} }: CheckoutRequest = await req.json();

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found');
    }

    if (!plan.dodo_product_id) {
      throw new Error('This plan is not available for purchase');
    }

    if (!DODO_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'Payment system not configured',
          configured: false
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Enhanced request body with proper Dodo API format
    const requestBody = {
      product_cart: [
        {
          product_id: plan.dodo_product_id,
          quantity: 1,
        },
      ],
      customer: {
        email: profile.email,
        name: customerInfo.name || profile.full_name || '',
        phone_number: customerInfo.phone_number || undefined,
        ...(customerInfo.billing_address && { billing_address: customerInfo.billing_address }),
      },
      return_url: successUrl,
      metadata: {
        plan_id: planId,
        user_id: user.id,
        plan_name: plan.name,
        plan_display_name: plan.display_name,
        price_monthly: plan.price_monthly.toString(),
        ...metadata,
      },
    };

    console.log('Creating Dodo checkout with request:', JSON.stringify(requestBody, null, 2));

    // Retry logic for transient failures
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const dodoResponse = await fetch(`${DODO_API_BASE}/checkouts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DODO_API_KEY}`,
            'Content-Type': 'application/json',
            'User-Agent': 'AIConvertor/1.0',
          },
          body: JSON.stringify(requestBody),
        });

        const responseText = await dodoResponse.text();
        console.log(`Dodo API Response (attempt ${attempt}):`, {
          status: dodoResponse.status,
          statusText: dodoResponse.statusText,
          responseText: responseText.substring(0, 1000), // Limit log size
        });

        let responseBody;
        try {
          responseBody = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse Dodo API response:', parseError);
          console.error('Raw response:', responseText);
          throw new Error('Invalid response from payment provider');
        }

        if (!dodoResponse.ok) {
          console.error('Dodo API Error:', {
            status: dodoResponse.status,
            statusText: dodoResponse.statusText,
            body: responseBody,
          });

          // Don't retry on client errors (4xx)
          if (dodoResponse.status >= 400 && dodoResponse.status < 500) {
            return new Response(
              JSON.stringify({
                error: responseBody.message || responseBody.error || `Payment provider error: ${dodoResponse.status}`,
                details: responseBody,
                configured: true,
              }),
              {
                status: dodoResponse.status,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                },
              }
            );
          }

          throw new Error(`Dodo API error: ${dodoResponse.status} ${dodoResponse.statusText}`);
        }

        const data = responseBody;
        console.log('Dodo API Success Response (full):', JSON.stringify(data, null, 2));

        const checkoutUrl = data.checkout_url || data.url || data.payment_url || data.redirect_url;
        const checkoutSessionId = data.checkout_session_id || data.session_id || data.id;

        console.log('Extracted values:', {
          checkoutSessionId,
          checkoutUrl,
          allKeys: Object.keys(data)
        });

        if (!checkoutUrl) {
          throw new Error('Payment provider did not return a checkout URL');
        }

        // Create pending subscription record
        const subscriptionData = {
          user_id: user.id,
          plan_id: planId,
          status: 'pending',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          billing_period_start: new Date().toISOString(),
          billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          dodo_subscription_id: checkoutSessionId,
        };

        const { error: subError } = await supabase.from('subscriptions').insert(subscriptionData);

        if (subError) {
          console.error('Subscription insert error:', subError);
          // Don't fail the checkout, but log the error for debugging
        }

        return new Response(
          JSON.stringify({
            url: checkoutUrl,
            sessionId: checkoutSessionId,
            configured: true
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );

      } catch (error) {
        lastError = error as Error;
        console.error(`Checkout attempt ${attempt} failed:`, error);

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        console.log(`Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }

    // All retries failed
    console.error('All checkout attempts failed. Last error:', lastError);
    return new Response(
      JSON.stringify({
        error: lastError?.message || 'Payment service temporarily unavailable',
        configured: true,
        retryAttempts: maxRetries
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        configured: true
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});