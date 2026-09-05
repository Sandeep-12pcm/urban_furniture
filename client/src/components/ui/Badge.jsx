import React from 'react';
import { getStatusBadgeVariant } from '../../utils/currency';

export function Badge({
  children,
  variant,
  status,
  size = 'md',
  className = '',
}) {
  const badgeVariant = variant || (status ? getStatusBadgeVariant(status) : 'neutral');

  const variantStyles = {
    primary: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${
        variantStyles[badgeVariant] || variantStyles.neutral
      } ${sizeStyles[size] || sizeStyles.md} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          badgeVariant === 'success'
            ? 'bg-emerald-500'
            : badgeVariant === 'warning'
            ? 'bg-amber-500'
            : badgeVariant === 'danger'
            ? 'bg-rose-500'
            : badgeVariant === 'primary'
            ? 'bg-indigo-500'
            : 'bg-slate-400'
        }`}
      />
      {children || status}
    </span>
  );
}
