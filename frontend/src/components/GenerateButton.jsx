import React from 'react';

export default function GenerateButton({ label, onClick, disabled, variant = 'primary' }) {
  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? `${base} bg-brand-600 text-white hover:bg-brand-700`
      : `${base} bg-white text-slate-700 border border-slate-300 hover:bg-slate-50`;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={styles}>
      {label}
    </button>
  );
}
