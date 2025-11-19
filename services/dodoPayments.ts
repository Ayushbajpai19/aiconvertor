import { supabase } from '../lib/supabase';

// Enhanced interfaces for comprehensive payment handling
interface CheckoutSessionParams {
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

interface CheckoutResponse {
  url?: string;
  sessionId?: string;
  error?: string;
  details?: any;
  configured: boolean;
  retryAttempts?: number;
}

interface PaymentMethod {
  id: string;
  type: string;
  last4?: string;
  brand?: string;
  expiry_month?: number;
  expiry_year?: number;
  is_default?: boolean;
}

interface SubscriptionStatus {
  id: string;
  status: string;
  plan_name: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  paused_until?: string;
  next_billing_date?: string;
}

// Error categories for better user experience
enum PaymentErrorType {
  NETWORK_ERROR = 'network_error',
  API_ERROR = 'api_error',
  VALIDATION_ERROR = 'validation_error',
  CONFIGURATION_ERROR = 'configuration_error',
  TIMEOUT_ERROR = 'timeout_error',
  RATE_LIMIT_ERROR = 'rate_limit_error'
}

class PaymentError extends Error {
  public readonly type: PaymentErrorType;
  public readonly retryable: boolean;
  public readonly userMessage: string;

  constructor(type: PaymentErrorType, message: string, userMessage?: string, retryable: boolean = false) {
    super(message);
    this.type = type;
    this.retryable = retryable;
    this.userMessage = userMessage || this.getDefaultUserMessage(type);
  }

  private getDefaultUserMessage(type: PaymentErrorType): string {
    switch (type) {
      case PaymentErrorType.NETWORK_ERROR:
        return 'Network connection issue. Please check your internet connection and try again.';
      case PaymentErrorType.API_ERROR:
        return 'Payment service temporarily unavailable. Please try again in a few moments.';
      case PaymentErrorType.VALIDATION_ERROR:
        return 'Invalid payment information provided. Please check your details and try again.';
      case PaymentErrorType.CONFIGURATION_ERROR:
        return 'Payment system configuration issue. Please contact support for assistance.';
      case PaymentErrorType.TIMEOUT_ERROR:
        return 'Request timed out. Please try again.';
      case PaymentErrorType.RATE_LIMIT_ERROR:
        return 'Too many requests. Please wait a moment and try again.';
      default:
        return 'An unexpected error occurred. Please try again or contact support.';
    }
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequestWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      if (response.ok) {
        return response;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
      console.error(`Request attempt ${attempt} failed:`, error);

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

  throw lastError || new Error('All retry attempts failed');
}

export const createCheckoutSession = async (params: CheckoutSessionParams): Promise<string> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'User not authenticated',
        'You must be logged in to create a checkout session.'
      );
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`;

    try {
      const response = await makeRequestWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const responseData: CheckoutResponse = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Categorize errors based on status and response
        if (response.status === 429) {
          throw new PaymentError(
            PaymentErrorType.RATE_LIMIT_ERROR,
            'Rate limit exceeded',
            responseData.error || 'Too many requests. Please wait a moment and try again.',
            true
          );
        }

        throw new PaymentError(
          PaymentErrorType.API_ERROR,
          `API error: ${response.status}`,
          responseData.error || 'Payment service temporarily unavailable.',
          true
        );
      }

      if (responseData.error) {
        // Check if it's a configuration issue
        if (responseData.error.includes('configured') || response.status === 503) {
          throw new PaymentError(
            PaymentErrorType.CONFIGURATION_ERROR,
            responseData.error,
            responseData.error || 'Payment system is not configured. Please contact support.'
          );
        }

        throw new PaymentError(
          PaymentErrorType.API_ERROR,
          responseData.error,
          responseData.error || 'Failed to create checkout session.'
        );
      }

      if (!responseData.configured) {
        throw new PaymentError(
          PaymentErrorType.CONFIGURATION_ERROR,
          'Payment system not configured',
          'Payment system is currently unavailable. Please contact support for assistance.'
        );
      }

      if (!responseData.url) {
        throw new PaymentError(
          PaymentErrorType.API_ERROR,
          'No checkout URL returned',
          'Unable to generate payment link. Please try again or contact support.'
        );
      }

      console.log('Checkout session created successfully:', { sessionId: responseData.sessionId });
      return responseData.url;
    } catch (error) {
      // Re-throw PaymentError instances as-is
      if (error instanceof PaymentError) {
        throw error;
      }

      // Categorize generic errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new PaymentError(
          PaymentErrorType.NETWORK_ERROR,
          'Network fetch failed',
          'Network connection issue. Please check your internet connection and try again.',
          true
        );
      }

      if (error.name === 'AbortError') {
        throw new PaymentError(
          PaymentErrorType.TIMEOUT_ERROR,
          'Request timeout',
          'Request timed out. Please try again.',
          true
        );
      }

      // Generic error wrapping
      throw new PaymentError(
        PaymentErrorType.API_ERROR,
        error.message || 'Unknown error',
        error.message || 'An unexpected error occurred. Please try again.',
        true
      );
    }
  } catch (error) {
    console.error('Checkout session creation failed:', error);
    throw error;
  }
};

// Enhanced payment method management
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'User not authenticated for payment methods'
      );
    }

    // This would integrate with Dodo Payments API for saved payment methods
    // For now, return empty array as this depends on Dodo API availability
    return [];
  } catch (error) {
    console.error('Failed to fetch payment methods:', error);
    throw error instanceof PaymentError ? error : new PaymentError(
      PaymentErrorType.API_ERROR,
      'Failed to fetch payment methods'
    );
  }
};

// Subscription status polling
export const pollSubscriptionStatus = async (
  sessionId: string,
  maxAttempts: number = 10,
  intervalMs: number = 2000
): Promise<SubscriptionStatus | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'User not authenticated for status polling'
      );
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/subscriptions?select=*&dodo_subscription_id=eq.${sessionId}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            const subscription = data[0];
            if (subscription.status !== 'pending') {
              return {
                id: subscription.id,
                status: subscription.status,
                plan_name: subscription.plan_name || 'Unknown',
                current_period_end: subscription.current_period_end,
                cancel_at_period_end: subscription.cancel_at_period_end,
                paused_until: subscription.paused_until,
                next_billing_date: subscription.billing_period_end,
              };
            }
          }
        }

        // Wait before next poll
        if (attempt < maxAttempts) {
          await sleep(intervalMs);
        }
      } catch (pollError) {
        console.error(`Polling attempt ${attempt} failed:`, pollError);
        if (attempt < maxAttempts) {
          await sleep(intervalMs);
        }
      }
    }

    return null; // Status not confirmed after all attempts
  } catch (error) {
    console.error('Subscription status polling failed:', error);
    throw error instanceof PaymentError ? error : new PaymentError(
      PaymentErrorType.API_ERROR,
      'Failed to check subscription status'
    );
  }
};

// Graceful degradation when service unavailable
export const checkPaymentServiceHealth = async (): Promise<{
  available: boolean;
  degraded: boolean;
  message?: string;
}> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
      {
        method: 'HEAD', // Lightweight request
        headers: {
          'User-Agent': 'AIConvertor/HealthCheck/1.0',
        },
      }
    );

    const available = response.ok || response.status < 500;
    const degraded = response.status >= 400;

    return {
      available,
      degraded,
      message: degraded ? 'Payment service experiencing issues' : undefined,
    };
  } catch (error) {
    console.error('Payment service health check failed:', error);
    return {
      available: false,
      degraded: true,
      message: 'Unable to reach payment service',
    };
  }
};

// Configuration status with detailed checks
export const isDodoPaymentsConfigured = async (): Promise<boolean> => {
  try {
    const health = await checkPaymentServiceHealth();
    return health.available && !health.degraded;
  } catch {
    return false;
  }
};

// Export error type for components to use
export { PaymentError, PaymentErrorType };
