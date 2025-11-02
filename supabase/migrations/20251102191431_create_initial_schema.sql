/*
  # Initial Database Schema for Statement Converter SaaS

  ## Overview
  Creates the complete database structure for a subscription-based PDF statement converter application with four-tier pricing model and Dodo Payments integration.

  ## New Tables

  ### 1. `profiles`
  User profile information extending Supabase Auth users
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, unique, not null)
  - `full_name` (text)
  - `avatar_url` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `subscription_plans`
  Available subscription tiers with features and limits
  - `id` (uuid, primary key)
  - `name` (text, unique) - Free, Basic, Professional, Enterprise
  - `display_name` (text) - User-friendly name
  - `price_monthly` (numeric) - Monthly price in dollars
  - `pdf_limit` (integer) - Monthly PDF conversion limit (null = unlimited)
  - `features` (jsonb) - Array of feature descriptions
  - `is_active` (boolean) - Whether plan is available for signup
  - `sort_order` (integer) - Display order on pricing page
  - `created_at` (timestamptz)

  ### 3. `subscriptions`
  User subscription records with status and dates
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles)
  - `plan_id` (uuid, references subscription_plans)
  - `status` (text) - active, cancelled, expired, past_due
  - `current_period_start` (timestamptz)
  - `current_period_end` (timestamptz)
  - `cancel_at_period_end` (boolean)
  - `dodo_subscription_id` (text) - Dodo Payments subscription ID
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `user_usage`
  Monthly conversion usage tracking with automatic reset
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles, unique)
  - `conversions_used` (integer) - Count for current period
  - `period_start` (timestamptz) - Start of current billing period
  - `period_end` (timestamptz) - End of current billing period
  - `updated_at` (timestamptz)

  ### 5. `conversions_history`
  Record of all PDF conversions performed by users
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles)
  - `filename` (text) - Original PDF filename
  - `file_size` (bigint) - File size in bytes
  - `transaction_count` (integer) - Number of transactions extracted
  - `storage_path` (text) - Path to stored CSV file in Supabase Storage
  - `status` (text) - success, failed, processing
  - `error_message` (text) - Error details if failed
  - `insights` (jsonb) - AI-generated financial insights
  - `created_at` (timestamptz)

  ### 6. `payments`
  Payment transaction records from Dodo Payments
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles)
  - `subscription_id` (uuid, references subscriptions)
  - `dodo_payment_id` (text, unique) - Dodo Payments transaction ID
  - `amount` (numeric) - Payment amount
  - `currency` (text) - Currency code (USD)
  - `status` (text) - succeeded, failed, pending, refunded
  - `payment_method` (text) - card, bank_transfer, etc.
  - `invoice_url` (text) - Link to invoice PDF
  - `created_at` (timestamptz)

  ## Security
  - Enable Row Level Security on all tables
  - Users can only access their own data
  - Subscription plans are publicly readable
  - Payment webhooks use service role key

  ## Indexes
  - Index on user_id columns for fast lookups
  - Index on subscription status for filtering
  - Index on conversion created_at for history pagination

  ## Functions
  - Function to get active subscription for user
  - Function to check conversion quota remaining
  - Trigger to update updated_at timestamps
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  pdf_limit integer,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES subscription_plans(id) NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz DEFAULT now() NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean DEFAULT false,
  dodo_subscription_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_status CHECK (status IN ('active', 'cancelled', 'expired', 'past_due'))
);

-- Create user_usage table
CREATE TABLE IF NOT EXISTS user_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  conversions_used integer DEFAULT 0 NOT NULL,
  period_start timestamptz DEFAULT now() NOT NULL,
  period_end timestamptz DEFAULT (now() + interval '1 month') NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create conversions_history table
CREATE TABLE IF NOT EXISTS conversions_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  filename text NOT NULL,
  file_size bigint,
  transaction_count integer DEFAULT 0,
  storage_path text,
  status text NOT NULL DEFAULT 'processing',
  error_message text,
  insights jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_conversion_status CHECK (status IN ('success', 'failed', 'processing'))
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  dodo_payment_id text UNIQUE,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  invoice_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_payment_status CHECK (status IN ('succeeded', 'failed', 'pending', 'refunded'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_conversions_user_id ON conversions_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversions_created_at ON conversions_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_dodo_id ON payments(dodo_payment_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversions_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for subscription_plans (publicly readable)
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_usage
CREATE POLICY "Users can view own usage"
  ON user_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON user_usage FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON user_usage FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for conversions_history
CREATE POLICY "Users can view own conversion history"
  ON conversions_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversions"
  ON conversions_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversions"
  ON conversions_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversions"
  ON conversions_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for payments
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_usage_updated_at
  BEFORE UPDATE ON user_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get active subscription for a user
CREATE OR REPLACE FUNCTION get_active_subscription(p_user_id uuid)
RETURNS TABLE(
  subscription_id uuid,
  plan_name text,
  plan_display_name text,
  pdf_limit integer,
  status text,
  period_end timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    sp.name,
    sp.display_name,
    sp.pdf_limit,
    s.status,
    s.current_period_end
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND s.current_period_end > now()
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check remaining conversions
CREATE OR REPLACE FUNCTION get_remaining_conversions(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_limit integer;
  v_used integer;
BEGIN
  -- Get user's plan limit
  SELECT sp.pdf_limit INTO v_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND s.current_period_end > now()
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- If no active subscription or unlimited plan
  IF v_limit IS NULL THEN
    RETURN -1;
  END IF;
  
  -- Get usage for current period
  SELECT COALESCE(conversions_used, 0) INTO v_used
  FROM user_usage
  WHERE user_id = p_user_id
    AND period_end > now();
  
  IF v_used IS NULL THEN
    v_used := 0;
  END IF;
  
  RETURN GREATEST(0, v_limit - v_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, price_monthly, pdf_limit, features, sort_order, is_active)
VALUES 
  (
    'free',
    'Free',
    0,
    1,
    '["1 PDF conversion total", "Basic transaction extraction", "CSV export"]'::jsonb,
    1,
    true
  ),
  (
    'basic',
    'Basic',
    9.99,
    50,
    '["50 PDFs per month", "Full conversion history", "AI financial insights", "CSV export", "Email support"]'::jsonb,
    2,
    true
  ),
  (
    'professional',
    'Professional',
    29.99,
    200,
    '["200 PDFs per month", "All Basic features", "Goal Planner tool", "Priority processing", "Advanced analytics", "Priority email support"]'::jsonb,
    3,
    true
  ),
  (
    'enterprise',
    'Enterprise',
    99.99,
    NULL,
    '["Unlimited PDFs", "All Professional features", "API access", "Custom integrations", "Dedicated account manager", "24/7 phone support", "SLA guarantee"]'::jsonb,
    4,
    true
  )
ON CONFLICT (name) DO NOTHING;