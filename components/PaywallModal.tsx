import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ isOpen, onClose }) => {
  const { subscription, remainingConversions } = useAuth();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const remaining = remainingConversions();
  const planName = subscription?.plan?.display_name || 'Free';

  const handleUpgrade = () => {
    onClose();
    navigate('/pricing');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 animate-fade-in">
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Conversion Limit Reached</h2>
            <p className="text-gray-600 mb-6">
              You've used all {remaining === 0 ? 'your' : ''} conversions in your <strong>{planName}</strong> plan.
              Upgrade to continue converting statements.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-600 mb-1">Current Plan</div>
              <div className="text-lg font-semibold text-gray-900">{planName}</div>
              <div className="text-sm text-gray-600 mt-2">
                {remaining} conversions remaining
              </div>
            </div>

            <div className="space-y-3">
              <Button onClick={handleUpgrade} className="w-full">
                Upgrade Now
              </Button>
              <button
                onClick={onClose}
                className="w-full px-6 py-3 text-gray-700 hover:text-gray-900 font-medium transition"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
