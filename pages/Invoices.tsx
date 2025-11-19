import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PaymentError, PaymentErrorType } from '../services/dodoPayments';

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: number;
  subtotal_amount: number;
  tax_amount: number;
  currency: string;
  issued_date: string;
  due_date: string;
  paid_date?: string;
  pdf_url?: string;
  pdf_filename: string;
  email_sent: boolean;
  sms_sent: boolean;
  notes?: string;
}

interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

const Invoices: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    per_page: 20,
    total_pages: 0,
  });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadInvoices();
  }, [pagination.page, statusFilter, searchTerm]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to view invoices');
      }

      let query = supabase
        .from('invoices')
        .select('*')
        .eq('user_id', session.user.id)
        .order('issued_date', { ascending: false });

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchTerm) {
        query = query.or('invoice_number.ilike.%searchTerm%', 'notes.ilike.%searchTerm%');
      }

      // Get total count for pagination
      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id);

      const total = count || 0;
      const totalPages = Math.ceil(total / pagination.per_page);
      const offset = (pagination.page - 1) * pagination.per_page;

      const { data, error } = await query
        .range(offset, pagination.per_page);

      if (error) {
        throw new Error(`Failed to load invoices: ${error.message}`);
      }

      setInvoices(data || []);
      setPagination({
        ...pagination,
        total,
        total_pages: totalPages,
      });

    } catch (err) {
      console.error('Failed to load invoices:', err);
      if (err instanceof PaymentError) {
        setError(err.userMessage);
      } else {
        setError('Failed to load invoices. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    if (!invoice.pdf_url) {
      setError('PDF not available for this invoice');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = invoice.pdf_url;
      link.download = invoice.pdf_filename;
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to download invoice');
    }
  };

  const handleEmailInvoice = async (invoice: Invoice) => {
    if (invoice.email_sent) {
      setError('Invoice has already been sent');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invoices/email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            invoiceId: invoice.id,
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setError('Invoice sent successfully');
        await loadInvoices(); // Refresh to show updated status
      } else {
        setError(result.error || 'Failed to send invoice');
      }
    } catch (err) {
      console.error('Email send failed:', err);
      if (err instanceof PaymentError) {
        setError(err.userMessage);
      } else {
        setError('Failed to send invoice');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft': return 'text-gray-600';
      case 'pending': return 'text-yellow-600';
      case 'sent': return 'text-blue-600';
      case 'paid': return 'text-green-600';
      case 'overdue': return 'text-red-600';
      case 'cancelled': return 'text-red-600';
      case 'refunded': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft': return 'Draft';
      case 'pending': return 'Pending';
      case 'sent': return 'Sent';
      case 'paid': return 'Paid';
      case 'overdue': return 'Overdue';
      case 'cancelled': return 'Cancelled';
      case 'refunded': return 'Refunded';
      default: return status;
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = !searchTerm ||
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-red-800">Error</h3>
              <p className="mt-2 text-red-700">{error}</p>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Invoices</h1>

      {/* Search and Filters */}
      <div className="bg-white shadow-lg rounded-lg border border-gray-200 mb-8 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Invoices
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by invoice number or notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              Status Filter
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white shadow-lg rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {filteredInvoices.length} Invoice{filteredInvoices.length === 1 ? '' : 's'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{invoice.invoice_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(invoice.issued_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(invoice.total_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs leading-5 font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                      {getStatusText(invoice.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(invoice.due_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {invoice.pdf_url && (
                        <button
                          onClick={() => handleDownloadPDF(invoice)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded-md border border-gray-300 transition-colors"
                          title="Download PDF"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 4h.01M7 10a5 5 0 11-11 0 5 5 0 0135 0l-5 5a5 5 0 0135 0z" />
                          </svg>
                        </button>
                      )}

                      {!invoice.email_sent && invoice.status === 'sent' && (
                        <button
                          onClick={() => handleEmailInvoice(invoice)}
                          className="text-green-600 hover:text-green-900 p-1 rounded-md border border-gray-300 transition-colors ml-2"
                          title="Send Email"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.5 7.5a8.5 8.5 0 016.5 0l-5.5 5.5a8.5 8.5 0 016.5 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex space-x-1">
                {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`relative inline-flex items-center px-3 py-2 text-sm font-medium ${
                      pageNum === pagination.page
                        ? 'text-blue-600 bg-blue-50 border-blue-500'
                        : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                    } rounded-md`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;