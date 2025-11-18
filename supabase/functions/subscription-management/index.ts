import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SubscriptionCancelRequest {
  subscriptionId: string;
  reason?: string;
  feedback?: string;
  immediate?: boolean;
}

interface SubscriptionPauseRequest {
  subscriptionId: string;
  durationMonths: 1 | 2 | 3; // 1-3 months
  reason?: string;
}

interface SubscriptionChangeRequest {
  subscriptionId: string;
  newPlanId: string;
  effectiveImmediately?: boolean;
  reason?: string;
}

interface SubscriptionStatusResponse {
  subscription: {
    id: string;
    status: string;
    effective_status: string;
    plan_name: string;
    plan_display_name: string;
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    paused_until?: string;
    pending_plan_id?: string;
    pending_plan_name?: string;
    change_effective_date?: string;
    can_change_plan: boolean;
    days_until_renewal: number;
  };
  pending_changes: {
    type: string;
    effective_date: string;
    from_plan: string;
    to_plan: string;
  } | null;
  available_actions: {
    can_pause: boolean;
    can_resume: boolean;
    can_cancel: boolean;
    can_upgrade: boolean;
    can_downgrade: boolean;
  };
}

interface SubscriptionHistoryResponse {
  changes: Array<{
    id: string;
    change_type: string;
    reason?: string;
    feedback?: string;
    scheduled_for?: string;
    effective_at?: string;
    old_plan_name?: string;
    new_plan_name?: string;
    created_at: string;
  }>;
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeWithRetry<T>(
  supabase: any,
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 2
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`${operationName} attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        break;
      }

      // Brief delay between retries
      await sleep(500 * attempt);
    }
  }

  throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
}

async function authenticateRequest(req: Request): Promise<{ supabase: any; userId: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Authorization header required');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Extract user ID from JWT token
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error('Invalid authentication token');
  }

  return { supabase, userId: user.id };
}

function validateSubscriptionAccess(supabase: any, userId: string, subscriptionId: string): Promise<boolean> {
  return executeWithRetry(async () => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('id', subscriptionId)
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new Error(`Subscription access check failed: ${error.message}`);
    }

    return !!data;
  }, 'validateSubscriptionAccess');
}

function createApiResponse<T>(success: boolean, data?: T, error?: string, message?: string): Response {
  const response: ApiResponse<T> = { success, data, error, message };

  return new Response(JSON.stringify(response), {
    status: success ? 200 : 400,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// GET /subscription/status - Get detailed subscription status
async function getSubscriptionStatus(supabase: any, userId: string, subscriptionId?: string): Promise<Response> {
  try {
    let query = supabase
      .from('active_subscriptions_with_changes')
      .select('*');

    if (subscriptionId) {
      query = query.eq('id', subscriptionId).single();
    } else {
      query = query.eq('user_id', userId).limit(1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch subscription status: ${error.message}`);
    }

    if (!data) {
      return createApiResponse(true, { subscription: null, available_actions: { can_pause: false, can_resume: false, can_cancel: false, can_upgrade: false, can_downgrade: false } });
    }

    // Calculate available actions based on status
    const availableActions = {
      can_pause: data.effective_status === 'active' && data.paused_until === null,
      can_resume: data.effective_status === 'paused' && data.paused_until && new Date(data.paused_until) > new Date(),
      can_cancel: ['active', 'paused', 'trialing'].includes(data.effective_status) && !data.cancel_at_period_end,
      can_upgrade: data.effective_status === 'active' && data.paused_until === null && !data.cancel_at_period_end,
      can_downgrade: data.effective_status === 'active' && data.paused_until === null && !data.cancel_at_period_end
    };

    const pendingChanges = data.pending_plan_id ? {
      type: 'plan_change',
      effective_date: data.change_effective_date,
      from_plan: data.current_plan_name,
      to_plan: data.pending_plan_name
    } : null;

    const responseData: SubscriptionStatusResponse = {
      subscription: data,
      pending_changes: pendingChanges,
      available_actions: availableActions
    };

    return createApiResponse(true, responseData);
  } catch (error) {
    console.error('Get subscription status error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// POST /subscription/cancel - Cancel subscription
async function cancelSubscription(supabase: any, userId: string, request: SubscriptionCancelRequest): Promise<Response> {
  try {
    // Validate access
    const canAccess = await validateSubscriptionAccess(supabase, userId, request.subscriptionId);
    if (!canAccess) {
      return createApiResponse(false, undefined, 'Subscription not found or access denied');
    }

    const result = await executeWithRetry(async () => {
      const { data, error } = await supabase
        .rpc('cancel_subscription', {
          p_subscription_id: request.subscriptionId,
          p_reason: request.reason || 'User requested cancellation',
          p_feedback: request.feedback,
          p_immediate: request.immediate || false
        });

      if (error) {
        throw new Error(`Cancel subscription failed: ${error.message}`);
      }

      return data;
    }, 'cancelSubscription');

    return createApiResponse(true, {
      cancelled: true,
      effective_date: result?.effective_date,
      message: request.immediate ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at the end of the current billing period'
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// POST /subscription/pause - Pause subscription
async function pauseSubscription(supabase: any, userId: string, request: SubscriptionPauseRequest): Promise<Response> {
  try {
    // Validate access
    const canAccess = await validateSubscriptionAccess(supabase, userId, request.subscriptionId);
    if (!canAccess) {
      return createApiResponse(false, undefined, 'Subscription not found or access denied');
    }

    // Validate duration
    if (![1, 2, 3].includes(request.durationMonths)) {
      return createApiResponse(false, undefined, 'Pause duration must be 1, 2, or 3 months');
    }

    const result = await executeWithRetry(async () => {
      const { data, error } = await supabase
        .rpc('pause_subscription', {
          p_subscription_id: request.subscriptionId,
          p_duration_months: request.durationMonths,
          p_reason: request.reason || `User requested pause for ${request.durationMonths} months`
        });

      if (error) {
        throw new Error(`Pause subscription failed: ${error.message}`);
      }

      return data;
    }, 'pauseSubscription');

    return createApiResponse(true, {
      paused: true,
      resume_date: result?.resume_date,
      message: `Subscription paused for ${request.durationMonths} month(s). It will automatically resume on ${result?.resume_date}`
    });

  } catch (error) {
    console.error('Pause subscription error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// POST /subscription/resume - Resume paused subscription
async function resumeSubscription(supabase: any, userId: string, subscriptionId: string): Promise<Response> {
  try {
    // Validate access
    const canAccess = await validateSubscriptionAccess(supabase, userId, subscriptionId);
    if (!canAccess) {
      return createApiResponse(false, undefined, 'Subscription not found or access denied');
    }

    const { data, error } = await executeWithRetry(async () => {
      const result = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          paused_until: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Resume subscription failed: ${error.message}`);
      }

      // Log the resume action
      await supabase
        .from('subscription_management_log')
        .insert({
          subscription_id: subscriptionId,
          user_id: userId,
          change_type: 'resumed',
          reason: 'User requested resume',
          effective_at: new Date().toISOString(),
          metadata: { resumed_at: new Date().toISOString() }
        });

      return result;
    }, 'resumeSubscription');

    return createApiResponse(true, {
      resumed: true,
      message: 'Subscription has been resumed successfully'
    });

  } catch (error) {
    console.error('Resume subscription error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// POST /subscription/change - Schedule plan change (upgrade/downgrade)
async function changeSubscriptionPlan(supabase: any, userId: string, request: SubscriptionChangeRequest): Promise<Response> {
  try {
    // Validate access
    const canAccess = await validateSubscriptionAccess(supabase, userId, request.subscriptionId);
    if (!canAccess) {
      return createApiResponse(false, undefined, 'Subscription not found or access denied');
    }

    // Get current subscription and target plan details
    const [subscription, targetPlan] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*, subscription_plans!inner(name, display_name)')
        .eq('id', request.subscriptionId)
        .eq('user_id', userId)
        .single(),
      supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', request.newPlanId)
        .single()
    ]);

    if (subscription.data && targetPlan.data) {
      const currentPlan = subscription.data.subscription_plans;

      // Validate change
      const isUpgrade = targetPlan.data.price_monthly > currentPlan.price_monthly;
      const isDowngrade = targetPlan.data.price_monthly < currentPlan.price_monthly;

      if (!isUpgrade && !isDowngrade) {
        return createApiResponse(false, undefined, 'New plan must be different from current plan');
      }

      const changeType = isUpgrade ? 'upgraded' : 'downgraded';

      const result = await executeWithRetry(async () => {
        const { data, error } = await supabase
          .rpc('schedule_subscription_change', {
            p_subscription_id: request.subscriptionId,
            p_new_plan_id: request.newPlanId,
            p_change_type: changeType,
            p_reason: request.reason || `User requested ${changeType} to ${targetPlan.data.display_name}`,
            p_effective_date: request.effectiveImmediately ? new Date().toISOString() : null
          });

        if (error) {
          throw new Error(`Plan change failed: ${error.message}`);
        }

        return data;
      }, 'changeSubscriptionPlan');

      const effectiveDate = request.effectiveImmediately ?
        new Date().toISOString() :
        subscription.data.current_period_end;

      return createApiResponse(true, {
        scheduled: true,
        change_type: changeType,
        from_plan: currentPlan.display_name,
        to_plan: targetPlan.data.display_name,
        effective_date: effectiveDate,
        message: request.effectiveImmediately ?
          `Plan changed to ${targetPlan.data.display_name} effective immediately` :
          `Plan will change to ${targetPlan.data.display_name} on ${effectiveDate}`
      });
    }

    return createApiResponse(false, undefined, 'Subscription or target plan not found');

  } catch (error) {
    console.error('Change subscription plan error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /subscription/history - Get subscription change history
async function getSubscriptionHistory(supabase: any, userId: string, subscriptionId?: string, page: number = 1, perPage: number = 20): Promise<Response> {
  try {
    let query = supabase
      .from('subscription_change_history')
      .select('*', { count: 'exact' });

    if (subscriptionId) {
      query = query.eq('subscription_id', subscriptionId);
    } else {
      query = query.eq('user_id', userId);
    }

    const offset = (page - 1) * perPage;
    query = query
      .range(offset, offset + perPage - 1)
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch subscription history: ${error.message}`);
    }

    const totalPages = Math.ceil((count || 0) / perPage);

    const responseData: SubscriptionHistoryResponse = {
      changes: data || [],
      pagination: {
        total: count || 0,
        page,
        per_page: perPage,
        total_pages: totalPages
      }
    };

    return createApiResponse(true, responseData);

  } catch (error) {
    console.error('Get subscription history error:', error);
    return createApiResponse(false, undefined, error.message);
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
    const { supabase, userId } = await authenticateRequest(req);
    const url = new URL(req.url);
    const path = url.pathname;

    // Route handling
    if (path.endsWith('/status') && req.method === 'GET') {
      const subscriptionId = url.searchParams.get('subscriptionId');
      return await getSubscriptionStatus(supabase, userId, subscriptionId);
    }

    if (path.endsWith('/cancel') && req.method === 'POST') {
      const request: SubscriptionCancelRequest = await req.json();
      return await cancelSubscription(supabase, userId, request);
    }

    if (path.endsWith('/pause') && req.method === 'POST') {
      const request: SubscriptionPauseRequest = await req.json();
      return await pauseSubscription(supabase, userId, request);
    }

    if (path.endsWith('/resume') && req.method === 'POST') {
      const subscriptionId = (await req.json()).subscriptionId;
      return await resumeSubscription(supabase, userId, subscriptionId);
    }

    if (path.endsWith('/change') && req.method === 'POST') {
      const request: SubscriptionChangeRequest = await req.json();
      return await changeSubscriptionPlan(supabase, userId, request);
    }

    if (path.endsWith('/history') && req.method === 'GET') {
      const subscriptionId = url.searchParams.get('subscriptionId');
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = parseInt(url.searchParams.get('perPage') || '20');
      return await getSubscriptionHistory(supabase, userId, subscriptionId, page, perPage);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        available_endpoints: [
          'GET /subscription/status',
          'POST /subscription/cancel',
          'POST /subscription/pause',
          'POST /subscription/resume',
          'POST /subscription/change',
          'GET /subscription/history'
        ]
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Subscription management API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});