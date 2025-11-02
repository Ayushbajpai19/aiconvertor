import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Navbar: React.FC = () => {
  const { user, profile, subscription, remainingConversions, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const remaining = remainingConversions();
  const planName = subscription?.plan?.display_name || 'Free';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold text-gray-900 hidden sm:inline">Statement Converter</span>
              <span className="text-xl font-bold text-gray-900 sm:hidden">SC</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-gray-900 font-medium transition">
              Home
            </Link>
            {user && (
              <Link to="/history" className="text-gray-700 hover:text-gray-900 font-medium transition">
                History
              </Link>
            )}
            <Link to="/pricing" className="text-gray-700 hover:text-gray-900 font-medium transition">
              Pricing
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-3 bg-gray-50 hover:bg-gray-100 rounded-lg px-4 py-2 transition"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">{profile?.full_name || 'User'}</div>
                    <div className="text-xs text-gray-500">
                      {planName} {remaining >= 0 ? `(${remaining} left)` : ''}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">{profile?.email}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {planName} Plan
                        </div>
                      </div>
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Profile Settings
                      </Link>
                      <Link
                        to="/billing"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Billing & Subscription
                      </Link>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          handleSignOut();
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Link to="/login">
                  <button className="text-gray-700 hover:text-gray-900 font-medium transition">
                    Login
                  </button>
                </Link>
                <Link to="/register">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition">
                    Sign Up
                  </button>
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-200 mt-2 pt-4">
            <Link
              to="/"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            {user && (
              <Link
                to="/history"
                className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
                onClick={() => setIsMenuOpen(false)}
              >
                History
              </Link>
            )}
            <Link
              to="/pricing"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={() => setIsMenuOpen(false)}
            >
              Pricing
            </Link>
            {user ? (
              <>
                <div className="px-4 py-2 mt-2 border-t border-gray-200 pt-4">
                  <div className="text-sm font-medium text-gray-900">{profile?.full_name}</div>
                  <div className="text-xs text-gray-500 mt-1">{profile?.email}</div>
                  <div className="text-xs text-blue-600 mt-1">
                    {planName} Plan {remaining >= 0 ? `- ${remaining} conversions left` : ''}
                  </div>
                </div>
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profile Settings
                </Link>
                <Link
                  to="/billing"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Billing & Subscription
                </Link>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleSignOut();
                  }}
                  className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-50 rounded-lg"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="px-4 py-2 space-y-2 mt-2 border-t border-gray-200 pt-4">
                <Link
                  to="/login"
                  className="block text-center py-2 text-gray-700 hover:bg-gray-50 rounded-lg font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="block text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};
