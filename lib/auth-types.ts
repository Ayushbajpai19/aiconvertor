import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  pdf_limit: number | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  dodo_subscription_id: string | null;
  plan?: SubscriptionPlan;
}

export interface UserUsage {
  id: string;
  user_id: string;
  conversions_used: number;
  period_start: string;
  period_end: string;
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  subscription: Subscription | null;
  usage: UserUsage | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  canConvert: () => boolean;
  remainingConversions: () => number;
}
