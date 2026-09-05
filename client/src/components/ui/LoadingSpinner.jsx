import React from 'react';

export function LoadingSpinner({
  size = 'md',
  message = 'Loading...',
  fullScreen = false,
  className = '',
}) {
  const sizeMap = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`animate-spin rounded-full border-slate-200 border-t-indigo-600 ${
          sizeMap[size] || sizeMap.md
        }`}
      />
      {message && <p className="text-xs font-medium text-slate-500">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-xs">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
}
