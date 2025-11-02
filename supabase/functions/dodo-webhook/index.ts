import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface DodoWebhookPayload {
  event: string;
  data: {
    subscription_id: string;
    customer_id: string;
    amount: number;
    currency: string;
    status: string;
    payment_method?: string;
  };
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: DodoWebhookPayload = await req.json();

    console.log('Received webhook:', payload);

    if (payload.event === 'payment.succeeded') {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('dodo_subscription_id', payload.data.subscription_id)
        .single();

      if (subscription) {
        await supabase.from('payments').insert({
          user_id: subscription.user_id,
          subscription_id: subscription.id,
          dodo_payment_id: payload.data.subscription_id,
          amount: payload.data.amount,
          currency: payload.data.currency,
          status: 'succeeded',
          payment_method: payload.data.payment_method,
        });

        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', subscription.id);
      }
    }

    if (payload.event === 'payment.failed') {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('dodo_subscription_id', payload.data.subscription_id)
        .single();

      if (subscription) {
        await supabase.from('payments').insert({
          user_id: subscription.user_id,
          subscription_id: subscription.id,
          dodo_payment_id: payload.data.subscription_id,
          amount: payload.data.amount,
          currency: payload.data.currency,
          status: 'failed',
          payment_method: payload.data.payment_method,
        });

        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('id', subscription.id);
      }
    }

    if (payload.event === 'subscription.cancelled') {
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', cancel_at_period_end: true })
        .eq('dodo_subscription_id', payload.data.subscription_id);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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