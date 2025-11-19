import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, webhook-id, webhook-signature, webhook-timestamp',
};

const DODO_WEBHOOK_SECRET = Deno.env.get('DODO_WEBHOOK_SECRET');

// Dodo webhook payload structure based on documentation
interface DodoWebhookPayload {
  business_id: string;
  type: string;
  timestamp: string;
  data: {
    payload_type: 'Payment' | 'Subscription' | 'Refund' | 'Dispute' | 'LicenseKey';
    // Payment specific fields
    id?: string;
    subscription_id?: string;
    customer_id?: string;
    amount?: number;
    currency?: string;
    status?: string;
    payment_method?: string;
    invoice_url?: string;
    // Subscription specific fields
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    plan?: {
      id: string;
      name: string;
      amount: number;
      currency: string;
      interval: string;
    };
    // Common fields
    metadata?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
  };
}

interface WebhookEvent {
  id: string;
  type: string;
  processed: boolean;
  processing_attempts: number;
  processing_error?: string;
  payload: any;
  received_at: string;
  processed_at?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookId: string,
  timestamp: string
): Promise<boolean> {
  if (!DODO_WEBHOOK_SECRET) {
    console.warn('Webhook secret not configured, skipping signature verification');
    return true; // In development/test mode
  }

  try {
    // Concatenate webhook-id, timestamp, and payload with periods
    const signedPayload = `${webhookId}.${timestamp}.${payload}`;

    // Compute HMAC SHA256
    const computedSignature = createHash('sha256')
      .update(signedPayload)
      .update(DODO_WEBHOOK_SECRET)
      .digest('hex');

    // Compare with received signature
    return computedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function processWebhookEvent(
  supabase: any,
  payload: DodoWebhookPayload,
  webhookId: string
): Promise<void> {
  const { type, data } = payload;

  console.log(`Processing webhook event: ${type}`, { data });

  switch (type) {
    case 'payment.succeeded':
      await handlePaymentSucceeded(supabase, data, webhookId);
      break;

    case 'payment.failed':
      await handlePaymentFailed(supabase, data, webhookId);
      break;

    case 'subscription.created':
      await handleSubscriptionCreated(supabase, data, webhookId);
      break;

    case 'subscription.updated':
      await handleSubscriptionUpdated(supabase, data, webhookId);
      break;

    case 'subscription.cancelled':
      await handleSubscriptionCancelled(supabase, data, webhookId);
      break;

    case 'subscription.renewed':
      await handleSubscriptionRenewed(supabase, data, webhookId);
      break;

    case 'customer.updated':
      await handleCustomerUpdated(supabase, data, webhookId);
      break;

    default:
      console.warn(`Unhandled webhook event type: ${type}`);
  }
}

async function handlePaymentSucceeded(
  supabase: any,
  paymentData: any,
  webhookId: string
): Promise<void> {
  try {
    // Find subscription by Dodo subscription ID or create new one
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('dodo_subscription_id', paymentData.subscription_id)
      .single();

    if (subscription) {
      // Create payment record
      await supabase.from('payments').insert({
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        dodo_payment_id: paymentData.id,
        amount: paymentData.amount,
        currency: paymentData.currency || 'USD',
        status: 'succeeded',
        payment_method: paymentData.payment_method,
        invoice_url: paymentData.invoice_url,
      });

      // Update subscription if it was pending
      if (subscription.status === 'pending') {
        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: paymentData.current_period_start || new Date().toISOString(),
            current_period_end: paymentData.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', subscription.id);
      }

      console.log(`Payment succeeded for subscription ${subscription.id}`);
    } else {
      // New subscription - create it
      const userId = paymentData.metadata?.user_id;
      const planId = paymentData.metadata?.plan_id;

      if (userId && planId) {
        const newSubscription = {
          user_id: userId,
          plan_id: planId,
          status: 'active',
          current_period_start: paymentData.current_period_start || new Date().toISOString(),
          current_period_end: paymentData.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          billing_period_start: paymentData.current_period_start || new Date().toISOString(),
          billing_period_end: paymentData.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          dodo_subscription_id: paymentData.subscription_id,
        };

        const { data: createdSubscription, error: subError } = await supabase
          .from('subscriptions')
          .insert(newSubscription)
          .select()
          .single();

        if (subError) {
          console.error('Failed to create subscription:', subError);
          throw subError;
        }

        // Create payment record
        await supabase.from('payments').insert({
          user_id: userId,
          subscription_id: createdSubscription.id,
          dodo_payment_id: paymentData.id,
          amount: paymentData.amount,
          currency: paymentData.currency || 'USD',
          status: 'succeeded',
          payment_method: paymentData.payment_method,
          invoice_url: paymentData.invoice_url,
        });

        console.log(`Created new subscription ${createdSubscription.id} for user ${userId}`);
      } else {
        console.warn('Payment succeeded but no user/plan info in metadata');
      }
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
    throw error;
  }
}

async function handlePaymentFailed(
  supabase: any,
  paymentData: any,
  webhookId: string
): Promise<void> {
  try {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('dodo_subscription_id', paymentData.subscription_id)
      .single();

    if (subscription) {
      // Create failed payment record
      await supabase.from('payments').insert({
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        dodo_payment_id: paymentData.id,
        amount: paymentData.amount,
        currency: paymentData.currency || 'USD',
        status: 'failed',
        payment_method: paymentData.payment_method,
      });

      // Update subscription status
      await supabase
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('id', subscription.id);

      console.log(`Payment failed for subscription ${subscription.id}`);
    }
  } catch (error) {
    console.error('Error handling payment failed:', error);
    throw error;
  }
}

async function handleSubscriptionCreated(
  supabase: any,
  subscriptionData: any,
  webhookId: string
): Promise<void> {
  try {
    console.log('Subscription created event:', subscriptionData);
    // Handled in payment.succeeded for most cases
    // This event can be used for additional tracking/notifications
  } catch (error) {
    console.error('Error handling subscription created:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(
  supabase: any,
  subscriptionData: any,
  webhookId: string
): Promise<void> {
  try {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('dodo_subscription_id', subscriptionData.id)
      .single();

    if (subscription) {
      await supabase
        .from('subscriptions')
        .update({
          status: subscriptionData.status || subscription.status,
          current_period_start: subscriptionData.current_period_start || subscription.current_period_start,
          current_period_end: subscriptionData.current_period_end || subscription.current_period_end,
          cancel_at_period_end: subscriptionData.cancel_at_period_end ?? subscription.cancel_at_period_end,
        })
        .eq('id', subscription.id);

      console.log(`Subscription ${subscription.id} updated`);
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error;
  }
}

async function handleSubscriptionCancelled(
  supabase: any,
  subscriptionData: any,
  webhookId: string
): Promise<void> {
  try {
    await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancel_at_period_end: true,
        cancellation_reason: 'Cancelled via Dodo Payments'
      })
      .eq('dodo_subscription_id', subscriptionData.id);

    console.log(`Subscription ${subscriptionData.id} cancelled`);
  } catch (error) {
    console.error('Error handling subscription cancelled:', error);
    throw error;
  }
}

async function handleSubscriptionRenewed(
  supabase: any,
  subscriptionData: any,
  webhookId: string
): Promise<void> {
  try {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('dodo_subscription_id', subscriptionData.id)
      .single();

    if (subscription) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: subscriptionData.current_period_start,
          current_period_end: subscriptionData.current_period_end,
        })
        .eq('id', subscription.id);

      console.log(`Subscription ${subscription.id} renewed`);
    }
  } catch (error) {
    console.error('Error handling subscription renewed:', error);
    throw error;
  }
}

async function handleCustomerUpdated(
  supabase: any,
  customerData: any,
  webhookId: string
): Promise<void> {
  try {
    console.log('Customer updated event:', customerData);
    // Can be used for profile synchronization if needed
  } catch (error) {
    console.error('Error handling customer updated:', error);
    throw error;
  }
}

async function recordWebhookEvent(
  supabase: any,
  webhookId: string,
  eventType: string,
  payload: any,
  processed: boolean,
  error?: string
): Promise<void> {
  try {
    await supabase.from('webhook_events').upsert({
      webhook_id: webhookId,
      event_type: eventType,
      processed,
      processing_error: error,
      payload: payload,
      received_at: new Date().toISOString(),
      processed_at: processed ? new Date().toISOString() : null,
    });
  } catch (recordError) {
    console.error('Failed to record webhook event:', recordError);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const webhookId = req.headers.get('webhook-id');
    const signature = req.headers.get('webhook-signature');
    const timestamp = req.headers.get('webhook-timestamp');

    if (!webhookId || !signature || !timestamp) {
      console.error('Missing required webhook headers');
      return new Response(
        JSON.stringify({ error: 'Missing required webhook headers' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payloadText = await req.text();

    // Verify webhook signature
    const isValidSignature = await verifyWebhookSignature(
      payloadText,
      signature,
      webhookId,
      timestamp
    );

    if (!isValidSignature) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload: DodoWebhookPayload = JSON.parse(payloadText);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if already processed (idempotency)
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('processed')
      .eq('webhook_id', webhookId)
      .single();

    if (existingEvent?.processed) {
      console.log(`Webhook ${webhookId} already processed, skipping`);
      return new Response(
        JSON.stringify({ received: true, already_processed: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Record webhook event
    await recordWebhookEvent(supabase, webhookId, payload.type, payload, false);

    // Process with retry logic
    let processingError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await processWebhookEvent(supabase, payload, webhookId);

        // Mark as processed
        await recordWebhookEvent(supabase, webhookId, payload.type, payload, true);

        console.log(`Webhook ${webhookId} processed successfully (attempt ${attempt})`);
        break;
      } catch (error) {
        processingError = error as Error;
        console.error(`Webhook processing attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          // Record final error
          await recordWebhookEvent(
            supabase,
            webhookId,
            payload.type,
            payload,
            false,
            processingError.message
          );
          break;
        }

        // Exponential backoff
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        await sleep(delayMs);
      }
    }

    if (processingError) {
      console.error(`All webhook processing attempts failed for ${webhookId}:`, processingError);
      return new Response(
        JSON.stringify({
          error: 'Processing failed',
          webhookId,
          attempts: maxRetries
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ received: true, processed: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});