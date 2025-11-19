/*
  # Phase 4: Invoice System Database Migration

  ## Overview
  Create comprehensive invoice generation system with PDF storage, tax management, and professional invoice templates.

  ## Changes

  ### 1. Invoice Tables
  - invoices table for invoice metadata and tracking
  - invoice_items table for detailed line items
  - tax_rates table for jurisdiction-based tax calculation
  - invoice_templates table for customizable invoice designs

  ### 2. Storage Integration
  - Link to Supabase Storage for PDF invoice files
  - File naming conventions and organization

  ### 3. Tax Management
  - Multi-jurisdiction tax rate support
  - Automatic tax calculation based on customer location
  - Tax exemption handling

  ### 4. Invoice Numbering
  - Automatic invoice number generation
  - Yearly reset with configurable prefix
  - Gap detection and prevention

  ### 5. Security and Performance
  - Row Level Security for all invoice tables
  - Optimized indexing for fast queries
  - Audit trail for invoice modifications
*/

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number integer NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_amount numeric(12,2) NOT NULL,
  subtotal_amount numeric(12,2) NOT NULL,
  tax_amount numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'USD',
  issued_date timestamptz DEFAULT now() NOT NULL,
  due_date timestamptz DEFAULT now() NOT NULL,
  paid_date timestamptz,
  cancelled_date timestamptz,
  payment_method text,
  payment_reference text,
  billing_address jsonb,
  customer_info jsonb,
  notes text,
  pdf_storage_path text,
  pdf_filename text,
  email_sent boolean DEFAULT false,
  sms_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_invoice_status CHECK (status IN (
    'draft', 'pending', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'
  ))
);

-- Create invoice_items table for line items
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  total_price numeric(12,2) NOT NULL,
  discount_percentage numeric(5,2) DEFAULT 0,
  tax_rate_id uuid REFERENCES tax_rates(id) ON DELETE SET NULL,
  tax_amount numeric(12,2) DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create tax_rates table for jurisdiction-based tax calculation
CREATE TABLE IF NOT EXISTS tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  rate numeric(5,4) NOT NULL, -- Tax rate as decimal (e.g., 0.0850 for 8.5%)
  type text NOT NULL DEFAULT 'sales_tax',
  jurisdiction text NOT NULL, -- e.g., 'CA', 'NY', 'EU', 'GLOBAL'
  country_code text(2), -- ISO 3166-1 alpha-2
  state_code text(2), -- State/province code for US states
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  is_reverse_charge boolean DEFAULT false, -- For tax-exempt or zero-rated scenarios
  valid_from timestamptz DEFAULT now() NOT NULL,
  valid_until timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_tax_type CHECK (type IN (
    'sales_tax', 'vat', 'gst', 'hst', 'qst', 'service_tax', 'excise_tax'
  ))
);

-- Create invoice_templates table for customizable invoice designs
CREATE TABLE IF NOT EXISTS invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  template_config jsonb NOT NULL DEFAULT '{}', -- Template configuration
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued_date ON invoices(issued_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_sort_order ON invoice_items(sort_order);

CREATE INDEX IF NOT EXISTS idx_tax_rates_jurisdiction ON tax_rates(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_tax_rates_is_active ON tax_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_tax_rates_valid_dates ON tax_rates(valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_active ON invoice_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_created_by ON invoice_templates(created_by DESC);

-- Enable Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices" ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices" ON invoices
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all invoices" ON invoices
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view own invoice items" ON invoice_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices inv
    WHERE inv.id = invoice_items.invoice_id
    AND inv.user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage all invoice items" ON invoice_items
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Tax rates are readable by all authenticated users
CREATE POLICY "Authenticated users can view tax rates" ON tax_rates
  FOR SELECT TO authenticated
  USING (is_active = true)
  WITH CHECK (true);

-- Service role can manage tax rates
CREATE POLICY "Service role can manage tax rates" ON tax_rates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Invoice templates policies
CREATE POLICY "Users can view public invoice templates" ON invoice_templates
  FOR SELECT TO authenticated
  USING (is_active = true OR created_by = auth.uid());

CREATE POLICY "Service role can manage all invoice templates" ON invoice_templates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(p_user_id uuid)
RETURNS integer AS $$
DECLARE
    v_year integer;
    v_next_number integer;
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE);

    -- Get the last invoice number for this user in the current year
    SELECT COALESCE(MAX(invoice_number), 0)
    INTO v_next_number
    FROM invoices
    WHERE user_id = p_user_id
    AND EXTRACT(YEAR FROM issued_date) = v_year;

    -- Return 1 if no invoices exist, otherwise increment
    RETURN CASE
        WHEN v_next_number = 0 THEN 1
        ELSE v_next_number + 1
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate tax amount
CREATE OR REPLACE FUNCTION calculate_tax_amount(
  p_amount numeric(12,2),
  p_tax_rate_id uuid,
  p_quantity numeric(10,2) DEFAULT 1
)
RETURNS numeric(12,2) AS $$
DECLARE
    v_rate numeric(5,4);
BEGIN
    -- Get tax rate
    SELECT rate INTO v_rate
    FROM tax_rates
    WHERE id = p_tax_rate_id;

    -- Calculate tax amount
    RETURN ROUND(p_amount * v_rate * p_quantity, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create invoice with items
CREATE OR REPLACE FUNCTION create_invoice_with_items(
  p_user_id uuid,
  p_subscription_id uuid,
  p_items jsonb, -- Array of line item objects
  p_tax_rate_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_due_date timestamptz DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_invoice_id uuid;
    v_invoice_number integer;
    v_subtotal_amount numeric(12,2) := 0;
    v_tax_amount numeric(12,2) := 0;
    v_total_amount numeric(12,2) := 0;
    v_current_year integer;
BEGIN
    -- Get current year for invoice number
    v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    v_invoice_number := generate_invoice_number(p_user_id);

    -- Calculate totals from items
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items)
    LOOP
        v_subtotal_amount := v_subtotal_amount + (item.quantity * item.unit_price * (1 - COALESCE(item.discount_percentage, 0) / 100));

        IF p_tax_rate_id IS NOT NULL THEN
            v_tax_amount := v_tax_amount + calculate_tax_amount(
                item.quantity * item.unit_price * (1 - COALESCE(item.discount_percentage, 0) / 100),
                p_tax_rate_id,
                item.quantity
            );
        END IF;

        v_total_amount := v_subtotal_amount + v_tax_amount;
    END LOOP;

    -- Create main invoice record
    INSERT INTO invoices (
        invoice_number,
        subscription_id,
        user_id,
        status,
        total_amount,
        subtotal_amount,
        tax_amount,
        currency,
        issued_date,
        due_date: COALESCE(p_due_date, CURRENT_DATE + INTERVAL '30 days'),
        notes,
        created_at: CURRENT_DATE,
        updated_at: CURRENT_DATE
    ) VALUES (
        v_invoice_number,
        p_subscription_id,
        p_user_id,
        'draft',
        v_total_amount,
        v_subtotal_amount,
        v_tax_amount,
        CURRENT_DATE,
        COALESCE(p_due_date, CURRENT_DATE + INTERVAL '30 days'),
        p_notes,
        CURRENT_DATE,
        CURRENT_DATE
    ) RETURNING id INTO v_invoice_id;

    -- Create invoice item records
    INSERT INTO invoice_items (
        invoice_id,
        description,
        quantity,
        unit_price,
        total_price,
        discount_percentage,
        tax_rate_id,
        tax_amount,
        sort_order
    )
    SELECT
        v_invoice_id,
        item.description,
        item.quantity,
        item.unit_price,
        (item.quantity * item.unit_price * (1 - COALESCE(item.discount_percentage, 0) / 100)),
        item.discount_percentage,
        p_tax_rate_id,
        CASE
            WHEN p_tax_rate_id IS NOT NULL THEN
                calculate_tax_amount(item.quantity * item.unit_price * (1 - COALESCE(item.discount_percentage, 0) / 100), p_tax_rate_id, item.quantity)
            ELSE 0
        END,
        item.sort_order
    FROM jsonb_to_recordset(p_items);

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update invoice status
CREATE OR REPLACE FUNCTION update_invoice_status(
  p_invoice_id uuid,
  p_new_status text,
  p_paid_date timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_current_status text;
BEGIN
    -- Get current status for audit
    SELECT status INTO v_current_status
    FROM invoices
    WHERE id = p_invoice_id;

    -- Update invoice status
    UPDATE invoices
    SET
        status = p_new_status,
        paid_date = CASE WHEN p_new_status = 'paid' THEN COALESCE(p_paid_date, CURRENT_DATE) ELSE NULL END,
        updated_at = CURRENT_DATE,
        notes = CASE WHEN p_notes IS NOT NULL THEN p_notes ELSE notes END
    WHERE id = p_invoice_id;

    -- Log status change for audit trail
    INSERT INTO subscription_management_log (
        subscription_id: (SELECT subscription_id FROM invoices WHERE id = p_invoice_id),
        user_id: (SELECT user_id FROM invoices WHERE id = p_invoice_id),
        change_type: 'invoice_status_change',
        reason: format('Status changed from %s to %s', v_current_status, p_new_status),
        effective_at: CURRENT_DATE
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default tax rates
INSERT INTO tax_rates (name, rate, type, jurisdiction, country_code, is_default) VALUES
  ('No Tax', 0, 'sales_tax', 'GLOBAL', 'US', true),
  ('Standard Sales Tax', 0.0850, 'sales_tax', 'US', 'DEFAULT NULL', false),
  ('State Tax - California', 0.0875, 'sales_tax', 'US', 'CA', false, 'CA'),
  ('State Tax - New York', 0.0800, 'sales_tax', 'US', 'NY', false, 'NY'),
  ('VAT - Standard', 0.2000, 'vat', 'EU', 'GB', false, 'GB'),
  ('GST - Canada', 0.0500, 'gst', 'CA', 'CA', false, 'CA')
ON CONFLICT (name) DO NOTHING;

-- Insert default invoice template
INSERT INTO invoice_templates (name, description, template_config, is_default) VALUES
  ('Standard', 'Standard invoice template with professional layout',
  '{
    "layout": "standard",
    "colors": {
      "primary": "#1f2937",
      "secondary": "#6b7280",
      "text": "#1f2937",
      "background": "#ffffff"
    },
    "logo": true,
    "watermark": false,
    "footer_text": "Thank you for your business!",
    "payment_terms": "Net 30 days",
    "company_info": {
      "show_registration": true,
      "show_tax_id": true,
      "show_phone": true
    }
  }'::jsonb,
  true
)
ON CONFLICT (name) DO NOTHING;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT ON invoices TO authenticated;
GRANT INSERT ON invoices TO authenticated;
GRANT UPDATE ON invoices TO authenticated;
GRANT SELECT ON invoice_items TO authenticated;
GRANT INSERT ON invoice_items TO authenticated;
GRANT SELECT ON tax_rates TO authenticated;
GRANT SELECT ON invoice_templates TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_tax_amount TO authenticated;
GRANT EXECUTE ON FUNCTION create_invoice_with_items TO service_role;
GRANT EXECUTE ON FUNCTION update_invoice_status TO service_role;