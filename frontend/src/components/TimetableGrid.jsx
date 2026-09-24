import React from 'react';

export default function TimetableGrid({ days, periodsPerDay, entries, lookup }) {
  const cellFor = (day, period) =>
    entries.filter((e) => e.day === day && e.period === period);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-slate-100 border-b border-r border-slate-200 px-3 py-2 text-left font-medium text-slate-600 w-28">
              Day / Period
            </th>
            {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((p) => (
              <th key={p} className="border-b border-slate-200 px-3 py-2 text-center font-medium text-slate-600 min-w-[150px]">
                Period {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day}>
              <td className="sticky left-0 bg-slate-50 border-r border-b border-slate-200 px-3 py-2 font-medium text-slate-700">
                {day}
              </td>
              {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((period) => {
                const cellEntries = cellFor(day, period);
                return (
                  <td key={period} className="border-b border-slate-100 px-2 py-2 align-top">
                    {cellEntries.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <div className="space-y-1.5">
                        {cellEntries.map((e) => (
                          <div
                            key={e.sessionId}
                            className="rounded-md bg-brand-50 border border-brand-100 px-2 py-1.5"
                            title={e.sessionId}
                          >
                            <p className="font-medium text-brand-800 leading-tight">
                              {lookup.subject(e.subject)}
                            </p>
                            <p className="text-xs text-slate-600 leading-tight mt-0.5">
                              {lookup.faculty(e.faculty)}
                            </p>
                            <p className="text-xs text-slate-500 leading-tight">
                              {lookup.classroom(e.classroom)} · {lookup.division(e.division)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
