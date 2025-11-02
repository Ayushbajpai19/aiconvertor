
import React, { useState, useEffect } from 'react';

const messages = [
  "Initializing secure connection...",
  "Analyzing document structure...",
  "Extracting transactional data...",
  "Identifying dates and amounts...",
  "Cleaning up descriptions...",
  "Building your spreadsheet...",
  "Finalizing results...",
];

export const ProcessingView: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-6">
       <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <div className="flex flex-col items-center">
        <p className="text-xl font-semibold text-gray-800">Processing your statement</p>
        <p className="text-gray-500 mt-2 transition-opacity duration-500">{messages[messageIndex]}</p>
      </div>
    </div>
  );
};
