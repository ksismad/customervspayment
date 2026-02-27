import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2 } from 'lucide-react';

interface FileUploadProps {
  label: string;
  subLabel: string;
  accept: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  files: File[];
  onRemoveFile: (index: number) => void;
  colorClass?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  subLabel, 
  accept, 
  multiple = false, 
  onFilesSelected, 
  files, 
  onRemoveFile,
  colorClass = "blue"
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
    // Reset value to allow re-upload of same file
    if (inputRef.current) inputRef.current.value = '';
  };

  const bgColor = isDragging ? `bg-${colorClass}-50` : 'bg-white';
  const borderColor = isDragging ? `border-${colorClass}-500` : 'border-slate-200';
  const textColor = `text-${colorClass}-600`;

  return (
    <div className="w-full">
      <div 
        className={`relative border-2 border-dashed ${borderColor} ${bgColor} rounded-xl p-6 transition-all duration-200 ease-in-out hover:border-${colorClass}-400 cursor-pointer group`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input 
          ref={inputRef} 
          type="file" 
          accept={accept} 
          multiple={multiple} 
          className="hidden" 
          onChange={handleChange} 
        />
        
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className={`p-3 rounded-full bg-${colorClass}-50 group-hover:bg-${colorClass}-100 transition-colors`}>
            <Upload className={`w-6 h-6 ${textColor}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            <p className="text-xs text-slate-500 mt-1">{subLabel}</p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selected Files</p>
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700 truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onRemoveFile(idx); }}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
