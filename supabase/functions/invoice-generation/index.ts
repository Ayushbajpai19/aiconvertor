import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  tax_rate_id?: string;
}

interface InvoiceGenerationRequest {
  subscription_id?: string;
  items: InvoiceItem[];
  due_date?: string;
  notes?: string;
  payment_method?: string;
  customer_info?: {
    name?: string;
    email?: string;
    billing_address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      zipcode?: string;
    };
  };
}

interface InvoiceResponse {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  subtotal_amount: number;
  tax_amount: number;
  currency: string;
  due_date: string;
  pdf_url?: string;
  pdf_filename: string;
  created_at: string;
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

async function generateInvoicePDF(invoice: any, template: any): Promise<{ pdfBuffer: ArrayBuffer; filename: string }> {
  // Generate professional invoice HTML
  const htmlContent = generateInvoiceHTML(invoice, template);

  // Convert HTML to PDF using a browser-like environment
  // In production, this would use a proper PDF library like Puppeteer or similar
  // For now, we'll create a simplified PDF buffer
  const htmlWithStyles = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice ${invoice.invoice_number}</title>
    <style>
        body {
            font-family: 'Arial, sans-serif';
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background: #fff;
        }
        .invoice-header {
            border-bottom: 2px solid #eee;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .invoice-title {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .invoice-table th {
            background: #f8f9fa;
            color: #333;
            font-weight: bold;
            text-align: left;
            padding: 12px 8px;
            border: 1px solid #ddd;
        }
        .invoice-table td {
            padding: 12px 8px;
            text-align: left;
            border: 1px solid #ddd;
        }
        .invoice-total {
            text-align: right;
            font-weight: bold;
            font-size: 16px;
            margin-top: 20px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #eee;
            text-align: center;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>
  `;

  // Create a simple PDF buffer (in production, use a proper PDF library)
  const encoder = new TextEncoder();
  const data = encoder.encode(htmlWithStyles);

  return {
    pdfBuffer: data.buffer,
    filename: `invoice_${invoice.invoice_number}.pdf`
  };
}

function generateInvoiceHTML(invoice: any, template: any): string {
  const { colors, layout, company_info, payment_terms } = template.template_config;
  const issuedDate = new Date(invoice.issued_at).toLocaleDateString();
  const dueDate = new Date(invoice.due_date).toLocaleDateString();

  return `
    <div class="invoice-header">
        <div class="invoice-title">
            Invoice #${invoice.invoice_number}
        </div>
        <div class="invoice-info">
            <div>
                <strong>Date:</strong> ${issuedDate}<br>
                <strong>Due:</strong> ${dueDate}
            </div>
            <div>
                <strong>Status:</strong> ${invoice.status}<br>
                <strong>Amount:</strong> $${invoice.total_amount.toFixed(2)} ${invoice.currency}
            </div>
        </div>
    </div>

    ${company_info.show_logo ? `
    <div style="text-align: center; margin-bottom: 30px;">
        <img src="/logo.png" alt="Company Logo" style="max-width: 200px;">
    </div>
    ` : ''}

    <table class="invoice-table">
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                ${invoice.tax_amount > 0 ? '<th>Tax Rate</th>' : ''}
                <th>Tax Amount</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            ${invoice.items.map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>$${item.unit_price.toFixed(2)}</td>
                    ${invoice.tax_amount > 0 ? `<td>${item.tax_rate}%</td>` : '<td></td>'}
                    <td>$${item.tax_amount.toFixed(2)}</td>
                    <td>$${item.total_price.toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="invoice-total">
        <table style="width: 300px; margin-left: auto;">
            <tr>
                <td style="text-align: right;">Subtotal:</td>
                <td>$${invoice.subtotal_amount.toFixed(2)}</td>
            </tr>
            ${invoice.tax_amount > 0 ? `
                <tr>
                    <td style="text-align: right;">Tax:</td>
                    <td>$${invoice.tax_amount.toFixed(2)}</td>
                </tr>
            ` : ''}
            <tr style="border-top: 2px solid #000;">
                <td style="text-align: right;"><strong>Total:</strong></td>
                <td><strong>$${invoice.total_amount.toFixed(2)}</strong></td>
            </tr>
        </table>
    </div>

    <div class="footer">
        <p>${payment_terms.footer_text || 'Thank you for your business!'}</p>
        <p><strong>Payment Terms:</strong> ${payment_terms}</p>
        ${company_info.show_phone ? `<p><strong>Phone:</strong> ${company_info.phone}</p>` : ''}
    </div>
  `;
}

async function storePDFInSupabase(supabase: any, invoiceId: string, pdfBuffer: ArrayBuffer, filename: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(`${invoiceId}/${filename}`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (error) {
      throw new Error(`Failed to store PDF: ${error.message}`);
    }

    const publicUrl = data?.publicUrl;
    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded PDF');
    }

    return publicUrl;
  } catch (error) {
    console.error('PDF storage error:', error);
    throw new Error('Failed to store PDF file');
  }
}

// POST /invoices/generate - Generate new invoice
async function generateInvoice(supabase: any, userId: string, request: InvoiceGenerationRequest): Promise<Response> {
  try {
    const { data: invoiceData, error: invoiceError } = await supabase
      .rpc('create_invoice_with_items', {
        p_user_id: userId,
        p_subscription_id: request.subscription_id,
        p_items: JSON.stringify(request.items),
        p_tax_rate_id: request.items[0]?.tax_rate_id || null,
        p_notes: request.notes,
        p_due_date: request.due_date
      });

    if (invoiceError) {
      throw new Error(`Invoice generation failed: ${invoiceError}`);
    }

    const invoice = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (
          description,
          quantity,
          unit_price,
          total_price,
          discount_percentage,
          tax_amount
        ),
        tax_rates (
          name,
          rate
        )
      `)
      .eq('id', invoiceData)
      .single();

    if (!invoice) {
      throw new Error('Failed to retrieve generated invoice');
    }

    // Generate PDF
    const { pdfBuffer, filename } = await generateInvoicePDF(invoice, invoice);

    // Store PDF in Supabase Storage
    const pdfUrl = await storePDFInSupabase(supabase, invoice.id, pdfBuffer, filename);

    // Update invoice record with PDF info
    await supabase
      .from('invoices')
      .update({
        pdf_storage_path: pdfUrl,
        pdf_filename: filename
      })
      .eq('id', invoice.id);

    const responseData: InvoiceResponse = {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      status: invoice.status,
      total_amount: invoice.total_amount,
      subtotal_amount: invoice.subtotal_amount,
      tax_amount: invoice.tax_amount,
      currency: invoice.currency,
      due_date: invoice.due_date,
      pdf_url: pdfUrl,
      pdf_filename: filename,
      created_at: invoice.created_at,
    };

    return createApiResponse(true, responseData);

  } catch (error) {
    console.error('Generate invoice error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /invoices/list - List user invoices
async function listInvoices(supabase: any, userId: string, page: number = 1, perPage: number = 20): Promise<Response> {
  try {
    const offset = (page - 1) * perPage;

    const { data: invoices, error, count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, perPage);

    if (error) {
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }

    const totalPages = Math.ceil((count || 0) / perPage);

    return createApiResponse(true, {
      invoices: invoices || [],
      pagination: {
        total: count || 0,
        page,
        per_page: perPage,
        total_pages: totalPages,
      },
    });

  } catch (error) {
    console.error('List invoices error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// GET /invoices/:id/download - Download invoice PDF
async function downloadInvoice(supabase: any, userId: string, invoiceId: string): Promise<Response> {
  try {
    // Get invoice details
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('pdf_filename, pdf_storage_path, user_id')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.user_id !== userId) {
      throw new Error('Access denied');
    }

    if (!invoice.pdf_storage_path) {
      throw new Error('PDF not available for this invoice');
    }

    // Generate signed URL for PDF download (valid for 1 hour)
    const { data: { signedUrl }, error: signedError } = await supabase.storage
      .from('invoices')
      .createSignedUrl(invoice.pdf_storage_path, {
        expiresIn: 3600, // 1 hour in seconds
        download: 'invoice_' + invoice.pdf_filename,
      });

    if (signedError) {
      throw new Error(`Failed to generate download URL: ${signedError.message}`);
    }

    return createApiResponse(true, {
      download_url: signedUrl,
      filename: invoice.pdf_filename,
    });

  } catch (error) {
    console.error('Download invoice error:', error);
    return createApiResponse(false, undefined, error.message);
  }
}

// POST /invoices/:id/email - Email invoice to customer
async function emailInvoice(supabase: any, userId: string, invoiceId: string): Promise<Response> {
  try {
    // Get invoice details
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('pdf_filename, user_id, status, email_sent')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.user_id !== userId) {
      throw new Error('Access denied');
    }

    if (invoice.email_sent) {
      throw new Error('Invoice has already been sent');
    }

    // In a real implementation, this would integrate with an email service
    // For now, we'll just mark it as sent and return success
    await supabase
      .from('invoices')
      .update({ email_sent: true, updated_at: new Date().toISOString() })
      .eq('id', invoiceId);

    return createApiResponse(true, {
      message: 'Invoice marked as sent (email integration would be implemented here)',
    });

  } catch (error) {
    console.error('Email invoice error:', error);
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
    const params = url.searchParams;

    // Route handling
    if (path.endsWith('/generate') && req.method === 'POST') {
      const request: InvoiceGenerationRequest = await req.json();
      return await generateInvoice(supabase, userId, request);
    }

    if (path.endsWith('/list') && req.method === 'GET') {
      const page = parseInt(params.get('page') || '1');
      const perPage = parseInt(params.get('perPage') || '20');
      return await listInvoices(supabase, userId, page, perPage);
    }

    const pathParts = path.split('/');
    const invoiceId = pathParts[pathParts.length - 1];

    if (path.endsWith('/download') && req.method === 'GET' && invoiceId) {
      return await downloadInvoice(supabase, userId, invoiceId);
    }

    if (path.endsWith('/email') && req.method === 'POST' && invoiceId) {
      return await emailInvoice(supabase, userId, invoiceId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        available_endpoints: [
          'POST /invoices/generate',
          'GET /invoices/list',
          'GET /invoices/:id/download',
          'POST /invoices/:id/email'
        ]
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Invoice generation API error:', error);
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