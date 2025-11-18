import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UserListRequest {
  page?: number;
  perPage?: number;
  search?: string;
  statusFilter?: string;
  planFilter?: string;
}

interface UserManagementRequest {
  targetUserId: string;
  action: 'ban' | 'unban' | 'reset_password' | 'impersonate';
  reason?: string;
}

interface RevenueSummaryRequest {
  startDate?: string;
  endDate?: string;
  groupBy?: 'month' | 'plan' | 'day';
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function authenticateAdminRequest(req: Request): Promise<{ supabase: any; adminUserId: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Authorization header required');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Extract user ID and check admin role
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    throw new Error('Invalid authentication token');
  }

  // Check if user has admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    throw new Error('Admin access required');
  }

  return { supabase, adminUserId: user.id };
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

async function executeWithRetry<T>(
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
      await sleep(100 * attempt);
    }
  }

  throw lastError || new Error(`${operationName} failed after ${maxRetries} attempts`);
}

// GET /admin/users - List and search users
async function getUsers(supabase: any, request: UserListRequest): Promise<Response> {
  try {
    const page = parseInt(request.searchParams.get('page') || '1');
    const perPage = parseInt(request.searchParams.get('perPage') || '20');
    const search = request.searchParams.get('search') || '';
    const statusFilter = request.searchParams.get('status') || '';
    const planFilter = request.searchParams.get('plan') || '';
    const offset = (page - 1) * perPage;

    let query = supabase
      .from('admin_get_user_details')
      .select('*');

    // Apply filters
    if (search) {
      query = query.or('email.ilike.%searchTerm%', 'full_name.ilike.%searchTerm%');
    }

    if (statusFilter) {
      query = query.or('p.status.ilike.%statusFilter%', 's.status.ilike.%statusFilter%');
    }

    if (planFilter) {
      query = query.or('sp.name.ilike.%planFilter%', 'sp.display_name.ilike.%planFilter%');
    }

    query = query.order('created_at', { ascending: false }).range(offset, perPage);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    const totalPages = Math.ceil((count || 0) / perPage);

    return createApiResponse(true, {
      users: data || [],
      pagination: {
        total: count || 0,
        page,
        per_page: perPage,
        total_pages: totalPages,
      },
    });

  } catch (error) {
    console.error('Get users error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// POST /admin/users/:id/manage - User management actions
async function manageUser(supabase: any, targetUserId: string, request: UserManagementRequest): Promise<Response> {
  try {
    const request_body = await req.json();
    const { action, reason } = request_body;

    // Log admin action for audit trail
    await executeWithRetry(async () => {
      await supabase
        .from('admin_action_log')
        .insert({
          admin_user_id: targetUserId,
          target_user_id,
          action_type: 'user_management',
          action_details: {
            action,
            reason,
            target_user_id: targetUserId,
          performed_at: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        });
    }, 'manageUser');

    // Execute user management action
    let result = { success: false, message: 'Action not implemented' };

    switch (action) {
      case 'ban':
        await supabase.auth.admin.updateUserById(targetUserId, { banned: true, ban_reason: reason });
        result = { success: true, message: 'User banned successfully' };
        break;

      case 'unban':
        await supabase.auth.admin.updateUserById(targetUserId, { banned: false });
        result = { success: true, message: 'User unbanned successfully' };
        break;

      case 'reset_password':
        const { data, error } = await supabase.auth.admin.generatePasswordResetLink(targetUserId);
        if (!error && data) {
          result = { success: true, message: 'Password reset link generated', link: data.link };
        } else {
          result = { success: false, message: 'Failed to generate reset link' };
        }
        break;

      case 'impersonate':
        const { data, error } = await supabase.auth.admin.signInAsUser(targetUserId);
        if (!error && data?.session) {
          result = { success: true, message: 'Successfully impersonated user' };
        } else {
          result = { success: false, message: 'Failed to impersonate user' };
        }
        break;

      default:
        result = { success: false, message: 'Unknown action' };
    }

    return createApiResponse(true, result);

  } catch (error) {
    console.error('Manage user error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /admin/revenue - Revenue analytics
async function getRevenueSummary(supabase: any, request: RevenueSummaryRequest): Promise<Response> {
  try {
    const startDate = request.searchParams.get('startDate') || new Date(Date.now() - 365).toISOString().split('T')[0];
    const endDate = request.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const groupBy = request.searchParams.get('groupBy') || 'month';

    const { data, error } = await supabase
      .from('admin_get_revenue_summary')
      .call({
        p_start_date: startDate,
        p_end_date: endDate,
        p_group_by: groupBy
      });

    if (error) {
      throw new Error(`Failed to fetch revenue: ${error.message}`);
    }

    return createApiResponse(true, { summary: data || [] });

  } catch (error) {
    console.error('Get revenue summary error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /admin/churn-analysis - Churn analysis and predictions
async function getChurnAnalysis(supabase: any): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('admin_churn_analysis')
      .select('*')
      .order('month', { ascending: false })
      .limit(12); // Last 12 months

    if (error) {
      throw new Error(`Failed to fetch churn analysis: ${error.message}`);
    }

    return createApiResponse(true, { churn_analysis: data || [] });

  } catch (error) {
    console.error('Get churn analysis error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /admin/health - System health monitoring
async function getSystemHealth(supabase: any): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('admin_system_health')
      .select('*')
      .order('check_date', { ascending: false })
      .limit(1); // Most recent

    if (error) {
      throw new Error(`Failed to fetch system health: ${error.message}`);
    }

    return createApiResponse(true, { system_health: data || [] });

  } catch (error) {
    console.error('Get system health error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /admin/plan-performance - Plan performance metrics
async function getPlanPerformance(supabase: any): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('admin_plan_performance')
      .select('*')
      .order('month', { ascending: false })
      .limit(12);

    if (error) {
      throw new Error(`Failed to fetch plan performance: ${error.message}`);
    }

    return createApiResponse(true, { plan_performance: data || [] });

  } catch (error) {
    console.error('Get plan performance error:', error);
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
    const { supabase } = await authenticateAdminRequest(req);
    const url = new URL(req.url);
    const path = url.pathname;

    // Route handling
    if (path.endsWith('/users') && req.method === 'GET') {
      return await getUsers(supabase, req);
    }

    if (path.endsWith('/users/') && req.method === 'POST') {
      const pathParts = path.split('/');
      const targetUserId = pathParts[pathParts.length - 1];
      return await manageUser(supabase, targetUserId, await req.json());
    }

    if (path.endsWith('/revenue') && req.method === 'GET') {
      return await getRevenueSummary(supabase, req);
    }

    if (path.endsWith('/churn-analysis') && req.method === 'GET') {
      return await getChurnAnalysis(supabase);
    }

    if (path.endsWith('/health') && req.method === 'GET') {
      return await getSystemHealth(supabase);
    }

    if (path.endsWith('/plan-performance') && req.method === 'GET') {
      return await getPlanPerformance(supabase);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        available_endpoints: [
          'GET /admin/users',
          'POST /admin/users/:id/manage',
          'GET /admin/revenue',
          'GET /admin/churn-analysis',
          'GET /admin/health',
          'GET /admin/plan-performance'
        ]
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Admin dashboard API error:', error);
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