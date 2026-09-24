import React from 'react';

const VIEWS = [
  { id: 'division', label: 'By Division' },
  { id: 'faculty', label: 'By Faculty' },
  { id: 'room', label: 'By Room' },
];

export default function ViewSwitcher({ view, onChange, groups }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange({ mode: v.id, groupId: groups[v.id]?.[0]?.id })}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              view.mode === v.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {groups[view.mode]?.length > 0 && (
        <select
          className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white"
          value={view.groupId || ''}
          onChange={(e) => onChange({ mode: view.mode, groupId: e.target.value })}
        >
          {groups[view.mode].map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
