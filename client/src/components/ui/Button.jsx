import React from 'react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  icon: Icon,
  className = '',
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 select-none';

  const sizeStyles = {
    sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
    md: 'h-10 px-4 text-sm rounded-xl gap-2',
    lg: 'h-12 px-6 text-base rounded-xl gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-indigo-900 text-white shadow-sm hover:bg-indigo-800 focus:ring-indigo-700 active:bg-indigo-950',
    secondary:
      'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus:ring-slate-300 active:bg-slate-100',
    outline:
      'border border-indigo-700 text-indigo-700 bg-transparent hover:bg-indigo-50 focus:ring-indigo-600',
    success:
      'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus:ring-emerald-500 active:bg-emerald-800',
    danger:
      'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus:ring-rose-500 active:bg-rose-800',
    ghost:
      'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-200',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${
        variantStyles[variant] || variantStyles.primary
      } ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {!loading && Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </button>
  );
}
