
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', icon, ...props }) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400',
  };

  return (
    <button className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
};
