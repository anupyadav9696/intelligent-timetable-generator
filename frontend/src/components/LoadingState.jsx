import React from 'react';

export default function LoadingState({ label = 'Generating timetable...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <div className="h-10 w-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin mb-4" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
