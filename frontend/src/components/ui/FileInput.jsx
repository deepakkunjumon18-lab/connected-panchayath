import React, { useRef, useState } from 'react';
import { UploadCloud, File, X } from 'lucide-react';

export default function FileInput({
  label,
  error,
  helperText = 'PDF, JPG, PNG up to 5 MB',
  required = false,
  accept = '.pdf,.jpg,.jpeg,.png',
  onChange,
  value,
  className = ''
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (onChange) onChange(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      if (onChange) onChange(e.target.files[0]);
    }
  };

  const clearFile = (e) => {
    e.stopPropagation();
    if (inputRef.current) inputRef.current.value = '';
    if (onChange) onChange(null);
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-ink mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {value ? (
        <div className="flex items-center justify-between p-3 bg-primary-50/50 border border-primary-200 rounded-xl">
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
              <File className="w-4 h-4" />
            </div>
            <div className="truncate text-left">
              <p className="text-sm font-medium text-ink truncate">
                {typeof value === 'string' ? value : value.name}
              </p>
              {value.size && (
                <p className="text-xs text-muted">
                  {(value.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="p-1 hover:bg-slate-200/50 rounded-lg text-muted hover:text-ink transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-150 ${
            dragActive
              ? 'border-primary-500 bg-primary-50'
              : error
              ? 'border-red-300 bg-red-50/30 hover:border-red-400'
              : 'border-line bg-white hover:border-primary-400 hover:bg-slate-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
          />
          <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-2">
            <UploadCloud className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-ink">
            <span className="text-primary-600 hover:underline">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted mt-1">{helperText}</p>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}
