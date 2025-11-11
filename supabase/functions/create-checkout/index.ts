import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DODO_API_KEY = Deno.env.get('DODO_API_KEY');
const DODO_API_BASE = 'https://api.dodopayments.com';

interface CheckoutRequest {
  planId: string;
  successUrl: string;
  cancelUrl: string;
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

    const { planId, successUrl, cancelUrl }: CheckoutRequest = await req.json();

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
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

    const requestBody = {
      product_cart: [
        {
          product_id: plan.dodo_product_id,
          quantity: 1,
        },
      ],
      customer: {
        email: profile.email,
      },
      return_url: successUrl,
      metadata: {
        plan_id: planId,
        user_id: user.id,
      },
    };

    console.log('Creating Dodo checkout with request:', JSON.stringify(requestBody, null, 2));

    const dodoResponse = await fetch(`${DODO_API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseBody = await dodoResponse.json();

    if (!dodoResponse.ok) {
      console.error('Dodo API Error:', {
        status: dodoResponse.status,
        statusText: dodoResponse.statusText,
        body: responseBody,
      });

      return new Response(
        JSON.stringify({
          error: responseBody.message || `Payment provider error: ${dodoResponse.status}`,
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

    const data = responseBody;

    console.log('Dodo API Success Response (full):', JSON.stringify(data, null, 2));

    const checkoutUrl = data.url || data.checkout_url || data.payment_url || data.redirect_url;
    const checkoutSessionId = data.checkout_session_id || data.session_id || data.id;

    console.log('Extracted values:', {
      checkoutSessionId,
      checkoutUrl,
      allKeys: Object.keys(data)
    });

    if (!checkoutUrl) {
      console.error('No checkout URL found in response. Full response:', data);
      return new Response(
        JSON.stringify({
          error: 'Payment provider did not return a checkout URL',
          details: data,
          configured: true,
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

    const { error: subError } = await supabase.from('subscriptions').insert({
      user_id: user.id,
      plan_id: planId,
      status: 'pending',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      dodo_subscription_id: checkoutSessionId,
    });

    if (subError) {
      console.error('Subscription insert error:', subError);
    }

    return new Response(
      JSON.stringify({ url: checkoutUrl, configured: true }),
      {
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