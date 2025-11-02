import React from 'react';
import { BackButton } from '../components/BackButton';

export const RefundPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 apple-gradient">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <BackButton />
        <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Refund & Cancellation Policy</h1>

          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              We aim to provide a high-quality experience. If you are not satisfied, you may be eligible for a refund as outlined below.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Refund Eligibility</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Refunds are available within 14 days of purchase if the service did not perform as described.</li>
              <li>To be eligible, you must provide details of the issue encountered.</li>
              <li>Refunds are processed to the original payment method within 5-10 business days.</li>
              <li>Multiple refund requests may be subject to additional review.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Cancellation Policy</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Cancellations stop future renewals; current billing periods are not refunded unless required by law.</li>
              <li>You can cancel your subscription at any time from your account settings.</li>
              <li>After cancellation, you will retain access to premium features until the end of your current billing period.</li>
              <li>Cancelled subscriptions can be reactivated at any time before the period ends.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Non-Refundable Situations</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Refunds are not available for partially used subscription periods.</li>
              <li>Services that were successfully delivered and used are not eligible for refunds.</li>
              <li>Refunds are not provided for user error or misunderstanding of service features.</li>
              <li>Violations of our Terms & Conditions forfeit refund eligibility.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">How to Request a Refund</h2>
            <p className="text-gray-600 mb-4">
              To request a refund or cancellation, contact support@example.com with your order details. Include:
            </p>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Your account email address</li>
              <li>Order or transaction ID</li>
              <li>Reason for refund request</li>
              <li>Description of any issues encountered</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Processing Time</h2>
            <p className="text-gray-600 mb-4">
              Refund requests are typically reviewed within 2-3 business days. Once approved, refunds are processed within 5-10 business days depending on your payment provider.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Policy Updates</h2>
            <p className="text-gray-600 mb-4">
              This policy may be updated over time. The latest version will always be available on this page. Continued use of our service after changes constitutes acceptance of the updated policy.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Contact Us</h2>
            <p className="text-gray-600">
              For questions about refunds or cancellations, please contact us at support@example.com. We're here to help resolve any concerns.
            </p>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
