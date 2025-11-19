interface InvoiceConfig {
  layout: 'standard' | 'minimal' | 'detailed';
  colors: {
    primary: string;
    secondary: string;
    text: string;
    background: string;
  };
  logo?: boolean;
  watermarked?: boolean;
  footer_text?: string;
  payment_terms?: string;
  company_info: {
    show_registration?: boolean;
    show_tax_id?: boolean;
    show_phone?: boolean;
    show_address?: boolean;
  };
}

interface InvoiceData {
  invoice_number: string;
  status: string;
  total_amount: number;
  subtotal_amount: number;
  tax_amount: number;
  currency: string;
  issued_date: string;
  due_date: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    discount_percentage?: number;
    tax_rate?: string;
    tax_amount: number;
    sort_order: number;
  }>;
  customer_info: {
    name?: string;
    email?: string;
    phone?: string;
    billing_address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      zipcode?: string;
    };
  };
  notes?: string;
  logo_url?: string;
  company_name: string;
  company_address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipcode?: string;
    phone?: string;
    email?: string;
    website?: string;
    tax_id?: string;
  registration_number?: string;
  };
}

export class InvoiceTemplate {
  private config: InvoiceConfig;

  constructor(config: InvoiceConfig) {
    this.config = config;
  }

  generateHTML(invoice: InvoiceData): string {
    const { layout, colors, logo, watermarked, footer_text, payment_terms, company_info } = this.config;

    const issuedDate = this.formatDate(invoice.issued_date);
    const dueDate = this.formatDate(invoice.due_date);

    const css = this.generateCSS(colors);

    const headerHTML = this.generateHeader(invoice, issuedDate, dueDate, logo);
    const companyHTML = this.generateCompanyInfo(invoice, company_info);
    const tableHTML = this.generateTable(invoice, css);
    const totalsHTML = this.generateTotals(invoice, css);
    const footerHTML = this.generateFooter(footer_text, payment_terms);

    const watermarkHTML = watermarked ? this.generateWatermark() : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice #${invoice.invoice_number}</title>
    <style>${css}</style>
</head>
<body>
    <div class="invoice-container">
        ${headerHTML}
        ${companyHTML}
        ${tableHTML}
        ${totalsHTML}
        ${footerHTML}
        ${watermarkHTML}
    </div>
</body>
</html>`;
  }

  private generateCSS(colors: InvoiceConfig['colors']): string {
    return `
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: ${colors.text};
            margin: 0;
            padding: 20px;
            background-color: ${colors.background};
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .invoice-header {
            border-bottom: 2px solid ${colors.primary};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .invoice-title {
            font-size: 28px;
            font-weight: bold;
            color: ${colors.primary};
            margin: 0;
        }
        .invoice-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .invoice-date {
            font-size: 14px;
            color: ${colors.secondary};
        }
        .invoice-status {
            font-size: 16px;
            font-weight: bold;
            padding: 6px 12px;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .company-info {
            margin-bottom: 30px;
        }
        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: ${colors.primary};
            margin-bottom: 10px;
        }
        .company-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        .company-contact {
            color: ${colors.secondary};
            font-size: 14px;
        }
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .invoice-table th {
            background-color: ${colors.primary};
            color: white;
            font-weight: bold;
            text-align: left;
            padding: 12px 8px;
            border: 1px solid #ddd;
            font-size: 14px;
        }
        .invoice-table td {
            padding: 12px 8px;
            text-align: left;
            border: 1px solid #ddd;
            font-size: 14px;
        }
        .invoice-table .numeric {
            text-align: right;
        }
        .invoice-table .description {
            min-width: 300px;
        }
        .invoice-totals {
            background-color: ${colors.primary};
            color: white;
            padding: 20px;
            border-radius: 4px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        .total-label {
            font-weight: bold;
            font-size: 16px;
        }
        .total-amount {
            font-weight: bold;
            font-size: 20px;
        }
        .invoice-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid ${colors.primary};
            text-align: center;
            font-size: 12px;
            color: ${colors.secondary};
        }
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 100px;
            color: rgba(0, 0, 0, 0.1);
            pointer-events: none;
            user-select: none;
            z-index: 9999;
        }
        @media print {
            .invoice-container {
                box-shadow: none;
                border: 1px solid #ddd;
            }
            .watermark {
                display: none;
            }
        }
    `;
  }

  private formatParagraph(text: string): string {
    return text.split('\n').map(line => line.trim()).join('<br>');
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  private formatDecimal(number: number): string {
    return number.toFixed(2);
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private getInvoiceStatus(status: string): { text: string; bg: string } {
    switch (status.toLowerCase()) {
      case 'draft':
        return { text: 'DRAFT', bg: '#6b7280' };
      case 'pending':
        return { text: 'PENDING', bg: '#eab308' };
      case 'sent':
        return { text: 'SENT', bg: '#3178c8' };
      case 'paid':
        return { text: 'PAID', bg: '#10b981' };
      case 'overdue':
        return { text: 'OVERDUE', bg: '#ef4444' };
      case 'cancelled':
        return { text: 'CANCELLED', bg: '#dc2626' };
      case 'refunded':
        return { text: 'REFUNDED', bg: '#7c3aed' };
      default:
        return { text: status.toUpperCase(), bg: '#6b7280' };
    }
  }

  private generateHeader(invoice: InvoiceData, issuedDate: string, dueDate: string, showLogo?: boolean): string {
    const status = this.getInvoiceStatus(invoice.status);

    return `
        <div class="invoice-header">
            <div class="invoice-title">Invoice #${invoice.invoice_number}</div>
            <div class="invoice-meta">
                <div class="invoice-date">
                    <strong>Date:</strong> ${issuedDate}<br>
                    <strong>Due:</strong> ${dueDate}
                </div>
                <div class="invoice-status" style="background-color: ${status.bg}; color: white;">
                    ${status.text}
                </div>
            </div>
        </div>
    `;
  }

  private generateCompanyInfo(invoice: InvoiceData, companyInfo?: InvoiceConfig['company_info']): string {
    if (!company_info) return '';

    const showRegistration = company_info.show_registration ?? true;
    const showTaxId = company_info.show_tax_id ?? true;
    const showPhone = company_info.show_phone ?? true;
    const showAddress = company_info.show_address ?? true;

    return `
        <div class="company-info">
            <div class="company-name">${invoice.company_name}</div>
            <div class="company-details">
                <div class="company-contact">
                    ${showAddress ? `
                        ${invoice.company_address?.street || ''}<br>
                        ${invoice.company_address?.city ? `${invoice.company_address.city}, ` : ''}${invoice.company_address?.state ? invoice.company_address.state : ''} ${invoice.company_address?.zipcode || ''}
                    ` : ''}
                    <br><br>
                        ${invoice.company_email || ''}
                        ${showPhone ? `<br>Phone: ${invoice.company_phone}` : ''}
                    ` : ''}
                    ${showTaxId ? `<br>Tax ID: ${invoice.company_tax_id || ''}` : ''}
                    ${showRegistration ? `<br>Reg #: ${invoice.company_registration_number || ''}` : ''}
                </div>
                <div class="company-contact">
                    ${invoice.company_website ? `Website: ${invoice.company_website}<br><br>` : ''}
                </div>
            </div>
        </div>
    `;
  }

  private generateTable(invoice: InvoiceData, css: string): string {
    const headerCSS = css.includes('invoice-table th') ? '' : `
        .invoice-table th {
            background-color: ${css.includes('colors.primary') ? this.config.colors.primary : '#3b82f6'};
            color: white;
            font-weight: bold;
            text-align: left;
            padding: 12px 8px;
            border: 1px solid #ddd;
            font-size: 14px;
        }
        .invoice-table td {
            padding: 12px 8px;
            text-align: left;
            border: 1px solid #ddd;
            font-size: 14px;
        }
        .invoice-table .numeric {
            text-align: right;
        }
        .invoice-table .description {
            min-width: 300px;
        }
    `;

    return `
        <table class="invoice-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    ${invoice.items.some(item => item.tax_amount > 0) ? '<th>Tax Rate</th>' : ''}
                    ${invoice.items.some(item => item.tax_amount > 0) ? '<th>Tax Amount</th>' : ''}
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items.map(item => `
                    <tr>
                        <td class="description">${this.formatParagraph(item.description)}</td>
                        <td class="numeric">${item.quantity}</td>
                        <td class="numeric">${this.formatCurrency(item.unit_price)}</td>
                        ${item.tax_rate ? `<td class="numeric">${item.tax_rate}%</td>` : '<td></td>'}
                        ${item.tax_rate ? `<td class="numeric">${this.formatCurrency(item.tax_amount)}</td>` : '<td></td>'}
                        <td class="numeric">${this.formatCurrency(item.total_price)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <style>${headerCSS}</style>
    `;
  }

  private generateTotals(invoice: InvoiceData, css: string): string {
    const discountAmount = invoice.total_amount - invoice.subtotal_amount;

    return `
        <div class="invoice-totals">
            <div class="total-row">
                <span class="total-label">Subtotal:</span>
                <span class="total-amount">${this.formatCurrency(invoice.subtotal_amount)}</span>
            </div>
            ${discountAmount > 0 ? `
                <div class="total-row">
                    <span class="total-label">Discount:</span>
                    <span class="total-amount">-${this.formatCurrency(discountAmount)}</span>
                </div>
            ` : ''}
            ${invoice.tax_amount > 0 ? `
                <div class="total-row">
                    <span class="total-label">Tax:</span>
                    <span class="total-amount">${this.formatCurrency(invoice.tax_amount)}</span>
                </div>
            ` : ''}
            <div class="total-row">
                <span class="total-label">Total:</span>
                <span class="total-amount">${this.formatCurrency(invoice.total_amount)}</span>
            </div>
        </div>
    `;
  }

  private generateFooter(footerText?: string, paymentTerms?: string): string {
    return `
        <div class="invoice-footer">
            ${footerText ? `<p>${this.formatParagraph(footerText)}</p>` : ''}
            ${paymentTerms ? `<p><strong>Payment Terms:</strong> ${this.formatParagraph(paymentTerms)}</p>` : ''}
        </div>
    `;
  }

  private generateWatermark(): string {
    return `<div class="watermark">UNPAID INVOICE</div>`;
  }

  // Method to update template configuration
  updateConfig(newConfig: Partial<InvoiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Method to get current configuration
  getConfig(): InvoiceConfig {
    return { ...this.config };
  }
}