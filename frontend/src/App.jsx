import React from 'react';
import Dashboard from './pages/Dashboard.jsx';

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Intelligent Timetable Generator</h1>
            <p className="text-sm text-slate-500">CSP-based scheduling for divisions, faculty and classrooms</p>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Dashboard />
      </main>
    </div>
  );
}
