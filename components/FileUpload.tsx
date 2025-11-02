import React, { useCallback, useRef, useState } from 'react';
import { DocumentArrowUpIcon } from './icons/DocumentArrowUpIcon';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onFilesSelect(Array.from(event.target.files));
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelect(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  }, [onFilesSelect]);


  return (
    <div
      className={`relative w-full max-w-lg mx-auto p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-300 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}
      onClick={handleClick}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
        multiple
      />
      <div className="flex flex-col items-center justify-center space-y-4 text-gray-600">
        <DocumentArrowUpIcon className="w-16 h-16 text-gray-400" />
        <p className="text-lg font-semibold text-gray-800">Drop your statements here</p>
        <p className="text-sm">or <span className="text-blue-600 font-semibold">browse files</span> on your computer</p>
        <p className="text-xs text-gray-400 mt-2">Supports multiple PDF bank statements from any bank</p>
      </div>
    </div>
  );
};