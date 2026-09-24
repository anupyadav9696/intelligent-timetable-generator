import React, { useMemo, useState } from 'react';
import { generateValidDemo, generateConflictDemo, fetchSampleEntities } from '../services/api.js';
import GenerateButton from '../components/GenerateButton.jsx';
import ConflictBanner from '../components/ConflictBanner.jsx';
import TimetableGrid from '../components/TimetableGrid.jsx';
import ViewSwitcher from '../components/ViewSwitcher.jsx';
import LoadingState from '../components/LoadingState.jsx';

function buildLookup(entities) {
  const byId = (list) => new Map((list || []).map((x) => [String(x.id), x]));
  const divisions = byId(entities?.divisions);
  const subjects = byId(entities?.subjects);
  const faculty = byId(entities?.faculty);
  const classrooms = byId(entities?.classrooms);
  return {
    division: (id) => divisions.get(String(id))?.name || id,
    subject: (id) => subjects.get(String(id))?.name || id,
    faculty: (id) => faculty.get(String(id))?.name || id,
    classroom: (id) => classrooms.get(String(id))?.name || id,
    divisions,
    subjects,
    classrooms,
  };
}

function downloadCsv(entries, lookup) {
  const header = ['Day', 'Period', 'Division', 'Subject', 'Faculty', 'Classroom'];
  const rows = entries.map((e) => [
    e.day,
    e.period,
    lookup.division(e.division),
    lookup.subject(e.subject),
    lookup.faculty(e.faculty),
    lookup.classroom(e.classroom),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'timetable.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [status, setStatus] = useState('empty'); // empty | loading | ready | error
  const [result, setResult] = useState(null);
  const [entities, setEntities] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [view, setView] = useState({ mode: 'division', groupId: null });
  const [activeDemo, setActiveDemo] = useState(null);

  const lookup = useMemo(() => buildLookup(entities), [entities]);

  const timeConfig = entities?.timeConfig || { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], periodsPerDay: 6 };

  const groups = useMemo(() => {
    if (!entities) return { division: [], faculty: [], room: [] };
    return {
      division: entities.divisions || [],
      faculty: entities.faculty || [],
      room: entities.classrooms || [],
    };
  }, [entities]);

  async function runDemo(kind) {
    setStatus('loading');
    setErrorMessage('');
    setActiveDemo(kind);
    try {
      const [genResult, sampleEntities] = await Promise.all([
        kind === 'valid' ? generateValidDemo() : generateConflictDemo(),
        fetchSampleEntities(kind),
      ]);
      setResult(genResult);
      setEntities(sampleEntities);
      const fieldMap = { division: 'divisions', faculty: 'faculty', room: 'classrooms' };
      setView((v) => ({ mode: v.mode, groupId: sampleEntities[fieldMap[v.mode]]?.[0]?.id || null }));
      setStatus('ready');
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || err.message || 'Something went wrong while generating the timetable.');
      setStatus('error');
    }
  }

  const filteredEntries = useMemo(() => {
    if (!result) return [];
    const field = view.mode === 'room' ? 'classroom' : view.mode;
    if (!view.groupId) return result.schedule;
    return result.schedule.filter((e) => String(e[field]) === String(view.groupId));
  }, [result, view]);

  const summary = entities
    ? {
        Divisions: entities.divisions?.length || 0,
        Subjects: entities.subjects?.length || 0,
        Faculty: entities.faculty?.length || 0,
        Classrooms: entities.classrooms?.length || 0,
        'Required Sessions': result?.statistics?.requiredSessions ?? '—',
        'Scheduled Sessions': result?.statistics?.scheduledSessions ?? '—',
      }
    : null;

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">Generate a Timetable</h2>
        <p className="text-sm text-slate-500 mt-1">
          Run the CSP solver against a demo dataset that is designed to succeed, or one that is
          intentionally impossible so you can see conflict diagnostics in action.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <GenerateButton
            label={status === 'loading' && activeDemo === 'valid' ? 'Generating...' : 'Generate Valid Demo'}
            onClick={() => runDemo('valid')}
            disabled={status === 'loading'}
          />
          <GenerateButton
            label={status === 'loading' && activeDemo === 'conflict' ? 'Generating...' : 'Generate Conflict Demo'}
            onClick={() => runDemo('conflict')}
            disabled={status === 'loading'}
            variant="secondary"
          />
          {result && result.schedule.length > 0 && (
            <GenerateButton label="Export CSV" onClick={() => downloadCsv(result.schedule, lookup)} variant="secondary" />
          )}
        </div>
      </section>

      {summary && (
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(summary).map(([label, value]) => (
            <div key={label} className="bg-white rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </section>
      )}

      {status === 'loading' && <LoadingState />}

      {status === 'error' && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 text-rose-800 p-4 text-sm">
          <p className="font-medium">Something went wrong</p>
          <p className="mt-1">{errorMessage}</p>
        </div>
      )}

      {status === 'empty' && (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <p className="font-medium">No timetable generated yet</p>
          <p className="text-sm mt-1">Click one of the demo buttons above to run the solver.</p>
        </div>
      )}

      {status === 'ready' && result && (
        <>
          <ConflictBanner result={result} />

          {result.schedule.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-base font-semibold text-slate-900">Timetable</h3>
                <ViewSwitcher view={view} onChange={setView} groups={groups} />
              </div>
              <TimetableGrid
                days={timeConfig.days}
                periodsPerDay={timeConfig.periodsPerDay}
                entries={filteredEntries}
                lookup={lookup}
              />
            </section>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
              <p className="font-medium">No sessions were scheduled</p>
              <p className="text-sm mt-1">See the diagnostics above for why.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
