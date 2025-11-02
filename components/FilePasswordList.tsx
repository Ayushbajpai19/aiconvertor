import React from 'react';
import { FileState } from '../types';
import { Button } from './Button';
import { LockClosedIcon } from './icons/LockClosedIcon';

interface FilePasswordListProps {
  files: FileState[];
  onPasswordChange: (id: string, password: string) => void;
  onConvert: () => void;
  isReady: boolean;
  onCancel: () => void;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const StatusBadge: React.FC<{ status: FileState['status'] }> = ({ status }) => {
  const statusStyles: { [key in FileState['status']]: { text: string, bg: string, dot: string } } = {
    pending: { text: 'text-gray-600', bg: 'bg-gray-100', dot: 'bg-gray-400' },
    needsPassword: { text: 'text-yellow-800', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
    ready: { text: 'text-green-800', bg: 'bg-green-100', dot: 'bg-green-500' },
    processing: { text: 'text-blue-800', bg: 'bg-blue-100', dot: 'bg-blue-500' },
    success: { text: 'text-green-800', bg: 'bg-green-100', dot: 'bg-green-500' },
    error: { text: 'text-red-800', bg: 'bg-red-100', dot: 'bg-red-500' },
  };
  
  const statusText: { [key in FileState['status']]: string } = {
    pending: 'Checking...',
    needsPassword: 'Password required',
    ready: 'Ready to convert',
    processing: 'Processing...',
    success: 'Converted',
    error: 'Failed',
  };

  const { text, bg, dot } = statusStyles[status];
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      <svg className={`-ml-0.5 mr-1.5 h-2 w-2 ${dot}`} fill="currentColor" viewBox="0 0 8 8">
        <circle cx={4} cy={4} r={3} />
      </svg>
      {statusText[status]}
    </span>
  );
};


export const FilePasswordList: React.FC<FilePasswordListProps> = ({ files, onPasswordChange, onConvert, isReady, onCancel }) => {
  return (
    <div className="w-full max-w-2xl mx-auto bg-white/80 backdrop-blur-lg border border-gray-200/50 shadow-sm rounded-2xl p-6 animate-fade-in">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">Your Statements</h2>
        <p className="text-sm text-gray-500 mt-1">Enter passwords for any protected files, then convert them all at once.</p>
      </div>

      <ul className="space-y-3">
        {files.map(fs => (
          <li key={fs.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{fs.file.name}</p>
                <p className="text-xs text-gray-500">{formatBytes(fs.file.size)}</p>
              </div>
              <div className="mt-2 sm:mt-0 sm:ml-4 flex-shrink-0">
                <StatusBadge status={fs.status} />
              </div>
            </div>
            {fs.status === 'needsPassword' && (
              <div className="mt-3">
                <label htmlFor={`password-${fs.id}`} className="sr-only">Password for {fs.file.name}</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </div>
                  <input
                    type="password"
                    id={`password-${fs.id}`}
                    className="block w-full rounded-md border-gray-300 pl-10 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Enter PDF Password"
                    onChange={(e) => onPasswordChange(fs.id, e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              </div>
            )}
            {fs.status === 'error' && fs.errorMessage && (
              <p className="mt-2 text-xs text-red-600">{fs.errorMessage}</p>
            )}
          </li>
        ))}
      </ul>
      
      <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-end gap-3">
        <Button onClick={onCancel} variant="secondary">Cancel</Button>
        <Button onClick={onConvert} disabled={!isReady}>
          {`Convert ${files.length} Statement(s)`}
        </Button>
      </div>
    </div>
  );
};
