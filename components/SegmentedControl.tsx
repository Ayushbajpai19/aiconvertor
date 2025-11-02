import React from 'react';

interface Option {
  label: string;
  value: string | number;
}

interface SegmentedControlProps {
  options: Option[];
  activeValue: string | number;
  onValueChange: (value: string | number) => void;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, activeValue, onValueChange }) => {
  return (
    <div className="flex w-full max-w-md mx-auto p-1 space-x-1 bg-gray-200/80 rounded-xl">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onValueChange(option.value)}
          className={`w-full px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
            activeValue === option.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'bg-transparent text-gray-500 hover:text-gray-900'
          }`}
          aria-pressed={activeValue === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
