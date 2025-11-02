import React from 'react';
import { BackButton } from '../components/BackButton';

export const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 apple-gradient">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <BackButton />
        <div className="bg-white rounded-2xl shadow-sm p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms & Conditions</h1>

          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 mb-6">
              By using this application, you agree to abide by these Terms & Conditions. If you do not agree, please do not use the service.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. Service Usage</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Service is provided on an "as is" and "as available" basis.</li>
              <li>We may update these terms at any time. Updates are effective upon posting.</li>
              <li>You are responsible for ensuring your use complies with applicable laws and regulations.</li>
              <li>We do not store your bank credentials. Uploaded statements are processed as described in our policies.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. Account Responsibilities</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You agree to provide accurate and complete information during registration.</li>
              <li>You must notify us immediately of any unauthorized access to your account.</li>
              <li>You are responsible for all activities that occur under your account.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. Subscription and Payments</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Subscription fees are billed monthly in advance.</li>
              <li>All fees are in US Dollars unless otherwise stated.</li>
              <li>You authorize us to charge your payment method for all fees incurred.</li>
              <li>Subscription renewals are automatic unless cancelled before the renewal date.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">4. Data Privacy</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>We process your data in accordance with our Privacy Policy.</li>
              <li>Uploaded documents are processed securely and are not shared with third parties.</li>
              <li>We implement industry-standard security measures to protect your data.</li>
              <li>You retain ownership of all data you upload to our service.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">5. Prohibited Activities</h2>
            <ul className="list-disc pl-6 text-gray-600 space-y-2">
              <li>Do not use the service for any illegal or unauthorized purpose.</li>
              <li>Do not attempt to gain unauthorized access to our systems.</li>
              <li>Do not interfere with or disrupt the service or servers.</li>
              <li>Do not upload malicious files or content that violates third-party rights.</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">6. Limitation of Liability</h2>
            <p className="text-gray-600 mb-4">
              To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">7. Termination</h2>
            <p className="text-gray-600 mb-4">
              We reserve the right to suspend or terminate your account at any time for violation of these terms or for any other reason at our discretion.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">8. Contact Information</h2>
            <p className="text-gray-600">
              For any questions regarding these Terms & Conditions, contact us at support@example.com.
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
