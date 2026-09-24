import React from 'react';

const STATUS_STYLES = {
  SUCCESS: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  PARTIAL: 'bg-amber-50 border-amber-300 text-amber-800',
  FAILED: 'bg-rose-50 border-rose-300 text-rose-800',
};

const STATUS_ICON = {
  SUCCESS: '✅',
  PARTIAL: '⚠️',
  FAILED: '❌',
};

export default function ConflictBanner({ result }) {
  if (!result) return null;
  const { status, message, diagnostics = [], unscheduled = [] } = result;
  const styles = STATUS_STYLES[status] || STATUS_STYLES.FAILED;

  return (
    <div className={`rounded-lg border p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none">{STATUS_ICON[status] || '❔'}</span>
        <div className="flex-1">
          <p className="font-semibold">{status}</p>
          <p className="text-sm mt-0.5">{message}</p>

          {unscheduled.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium">Unscheduled sessions ({unscheduled.length})</p>
              <ul className="mt-1 text-sm list-disc list-inside space-y-0.5">
                {unscheduled.map((u) => (
                  <li key={u.sessionId}>
                    <span className="font-mono">{u.sessionId}</span> — {u.reasons.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {diagnostics.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium">Diagnostics ({diagnostics.length})</p>
              <ul className="mt-1 text-sm space-y-1 max-h-48 overflow-y-auto pr-1">
                {diagnostics.map((d, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-white/70 border border-current shrink-0">
                      {d.code}
                    </span>
                    <span>{d.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
