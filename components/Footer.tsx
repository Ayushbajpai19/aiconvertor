import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-600 hover:text-gray-900 text-sm transition">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/history" className="text-gray-600 hover:text-gray-900 text-sm transition">
                  History
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-gray-600 hover:text-gray-900 text-sm transition">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Legal
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/terms" className="text-gray-600 hover:text-gray-900 text-sm transition">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="text-gray-600 hover:text-gray-900 text-sm transition">
                  Refund & Cancellation
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Support
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/contact" className="text-gray-600 hover:text-gray-900 text-sm transition">
                  Contact Us
                </Link>
              </li>
              <li>
                <a href="mailto:support@example.com" className="text-gray-600 hover:text-gray-900 text-sm transition">
                  support@example.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            &copy; {currentYear} Acme Corporation. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
