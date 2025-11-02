import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DODO_API_KEY = Deno.env.get('DODO_API_KEY');
const DODO_API_BASE = 'https://api.dodopayments.com/v1';

interface CheckoutRequest {
  planId: string;
  planName: string;
  amount: number;
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

    const { planId, planName, amount, successUrl, cancelUrl }: CheckoutRequest = await req.json();

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
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

    const dodoResponse = await fetch(`${DODO_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_email: profile.email,
        line_items: [
          {
            name: planName,
            amount: amount * 100,
            currency: 'USD',
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          plan_id: planId,
          user_id: user.id,
        },
      }),
    });

    if (!dodoResponse.ok) {
      const errorData = await dodoResponse.json();
      throw new Error(errorData.message || 'Failed to create checkout session');
    }

    const data = await dodoResponse.json();

    await supabase.from('subscriptions').insert({
      user_id: user.id,
      plan_id: planId,
      status: 'pending',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      dodo_subscription_id: data.id || data.session_id,
    });

    return new Response(
      JSON.stringify({ url: data.url, configured: true }),
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