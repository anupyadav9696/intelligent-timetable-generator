# Intelligent Timetable Generator

A MERN (MongoDB, Express, React, Node.js — plain JavaScript, no TypeScript) web
application that generates conflict-free college timetables using a genuine
**Constraint Satisfaction Problem (CSP)** solver: variables, domains, hard and soft
constraints, Minimum Remaining Values (MRV) variable ordering, constraint
propagation, and recursive backtracking with correct undo.

## Table of contents

- [Problem statement](#problem-statement)
- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [MongoDB setup](#mongodb-setup)
- [Environment variables](#environment-variables)
- [Installation](#installation)
- [Seeding the database](#seeding-the-database)
- [Running the backend](#running-the-backend)
- [Running the frontend](#running-the-frontend)
- [API documentation](#api-documentation)
- [Algorithm explanation](#algorithm-explanation)
- [Testing](#testing)
- [Demo instructions](#demo-instructions)
- [Troubleshooting](#troubleshooting)

## Problem statement

A college needs to generate a weekly timetable across multiple divisions, subjects,
faculty members, and classrooms, respecting hard constraints (no double-booking of
faculty/rooms/divisions, room capacity and type requirements, faculty/room/division
availability windows, exact weekly session counts) while detecting and clearly
explaining impossible/conflicting inputs rather than silently failing.

## Features

- Real CSP-based scheduler (not random, not a "generate then repair" approach).
- MRV variable selection + constraint propagation + backtracking with correct undo.
- Soft-constraint aware (spreads repeated sessions of a subject across days).
- Preflight feasibility checks that surface structural problems *before* an
  expensive search (division/faculty overload, no suitable room, insufficient lab
  capacity).
- Independent final validation pass — a schedule can never be reported `SUCCESS`
  unless it is re-verified from scratch.
- Rich failure diagnostics with specific constraint codes, not just "failed".
- `SUCCESS` / `PARTIAL` / `FAILED` result states with scheduled + unscheduled
  sessions and reasons.
- React dashboard: summary stats, generate-demo buttons, Day×Period grid, view
  switching (by Division / Faculty / Room), CSV export, loading/empty/error states.
- Two ready-made demo datasets: one that succeeds, one that's intentionally
  impossible.
- Automated tests (Jest + Supertest) covering constraints, preflight checks, the
  solver, and the API.

## Technology stack

**Backend:** Node.js 20+, Express.js, JavaScript, MongoDB, Mongoose, REST API,
dotenv, cors, Zod.

**Frontend:** React 18, JavaScript, Vite, React Router, Axios, Tailwind CSS.

**Testing:** Jest, Supertest.

## Architecture

```
React (Vite) dashboard
        │  Axios (REST, JSON)
        ▼
Express API  ──▶  TimetableService  ──▶  PreflightValidator
        │                │                       │
        │                ▼                       ▼
        │         TimetableSolver  ◀── ConstraintValidator
        │           (MRV + backtracking)          │
        │                │                        ▼
        │                └──────────────▶ ScoringEngine (soft constraints)
        ▼
   MongoDB (Mongoose models: Division, Subject, Faculty, Classroom, Timetable)
```

The scheduler package (`backend/src/scheduler/`) has **no dependency on
Express or Mongoose** — it operates on plain JS objects — so it can be unit tested
in isolation and reused by the seed script, the service layer, and the HTTP layer.

## Folder structure

```
timetable-generator/
├── backend/
│   └── src/
│       ├── config/db.js
│       ├── models/{Division,Subject,Faculty,Classroom,Timetable}.js
│       ├── validators/inputValidators.js
│       ├── scheduler/{TimetableSolver,ConstraintValidator,PreflightValidator,ScoringEngine}.js
│       ├── services/TimetableService.js
│       ├── controllers/{timetableController,crudControllerFactory}.js
│       ├── routes/timetableRoutes.js
│       ├── seed/{seedData,run-seed}.js
│       ├── tests/{solver,constraints,preflight,api}.test.js
│       ├── app.js
│       └── server.js
├── frontend/
│   └── src/
│       ├── components/{TimetableGrid,ConflictBanner,ViewSwitcher,GenerateButton,LoadingState}.jsx
│       ├── pages/Dashboard.jsx
│       ├── services/api.js
│       ├── App.jsx
│       └── main.jsx
├── README.md / APPROACH.md / ASSUMPTIONS.md / AI_USAGE_REPORT.md
└── package.json (root convenience scripts)
```

## Prerequisites

- Node.js **20+** and npm
- A MongoDB instance (local or Atlas) — see below

## MongoDB setup

You can use either:

- **Local MongoDB** — install MongoDB Community Server and run it on the default
  port, then use `mongodb://127.0.0.1:27017/timetable_generator` as-is.
- **MongoDB Atlas** — create a free cluster, get its connection string (looks like
  `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/timetable_generator`).

Either way, put the connection string in `backend/.env` as `MONGODB_URI` (see next
section). **The `/api/timetable/sample` and `/api/timetable/sample-conflict`
endpoints work even without MongoDB connected**, since the demo datasets are
in-memory — MongoDB is only required for the CRUD endpoints, persisted generation
history, and the seed script.

## Environment variables

Copy the example file and fill in your own values:

```bash
cd backend
cp .env.example .env
```

`backend/.env.example`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/timetable_generator
NODE_ENV=development
```

## Installation

```bash
cd timetable-generator
npm run install-all
```

This runs `npm install` in both `backend/` and `frontend/`. (Equivalent to running
`npm install` in each directory separately.)

> **Note:** this project was generated in a sandboxed environment without network
> access, so `npm install` has not been executed here — see `AI_USAGE_REPORT.md` for
> exactly what *was* validated. Running `npm run install-all` yourself is the first
> step to actually run the project.

## Seeding the database

```bash
cd backend
npm run seed
```

This clears and repopulates `Division`, `Subject`, `Faculty`, and `Classroom` with
the valid demo dataset (2 divisions, 6 subjects, 5 faculty, 4 classrooms).

## Running the backend

```bash
cd backend
npm run dev      # auto-restarts on file changes (node --watch)
# or
npm start        # plain node
```

The API listens on `http://localhost:5000` by default. Health check:
`GET http://localhost:5000/api/health`.

## Running the frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. Vite is configured to proxy `/api/*` requests to
`http://localhost:5000`, so the backend must be running for the dashboard to work.

## API documentation

All responses are JSON.

### `POST /api/timetable/generate`

Generate a timetable. Body (all fields optional; see below for what happens when
omitted):

```jsonc
{
  "useSample": "valid",          // "valid" | "conflict" — use a demo dataset
  // OR supply a full dataset inline:
  "divisions": [ /* Division input objects */ ],
  "subjects": [ /* Subject input objects, referencing division/faculty by id */ ],
  "faculty": [ /* Faculty input objects */ ],
  "classrooms": [ /* Classroom input objects */ ],
  "timeConfig": { "days": ["Monday", "..."], "periodsPerDay": 6,
                   "maxSearchNodes": 200000, "timeoutMs": 8000 }
}
```

If neither `useSample` nor a full inline dataset is supplied, the backend falls back
to whatever divisions/subjects/faculty/classrooms currently exist in MongoDB (i.e.
whatever `npm run seed` — or your own CRUD calls — put there).

Response shape:

```jsonc
{
  "status": "SUCCESS",              // "SUCCESS" | "PARTIAL" | "FAILED"
  "message": "Timetable generated successfully...",
  "schedule": [
    { "sessionId": "MATH-A-S1", "division": "...", "subject": "...",
      "faculty": "...", "classroom": "...", "day": "Monday", "period": 1 }
  ],
  "unscheduled": [ { "sessionId": "...", "reasons": ["FACULTY_CONFLICT"] } ],
  "diagnostics": [ { "code": "FACULTY_CAPACITY_EXCEEDED", "message": "..." } ],
  "statistics": {
    "scheduledSessions": 18, "requiredSessions": 18,
    "searchNodes": 19, "backtracks": 0, "durationMs": 87
  }
}
```

### `GET /api/timetable/sample`

Runs `generate` against the built-in **valid** demo dataset. Always demonstrates
`SUCCESS`.

### `GET /api/timetable/sample-conflict`

Runs `generate` against the built-in **impossible** demo dataset. Demonstrates
`FAILED` with meaningful diagnostics.

### `GET /api/timetable/sample-data/:kind`

`:kind` is `valid` or `conflict`. Returns the *raw* demo dataset (divisions,
subjects, faculty, classrooms, timeConfig) — used by the frontend to resolve names
for display and to build the view-switcher's group lists.

### `POST /api/timetable/validate`

Independently validates a proposed `schedule` array (same shape as a `generate`
response's `schedule`) against a dataset (`useSample` or inline, same as
`/generate`). Returns `{ valid: boolean, problems: [...] }`.

### `GET /api/timetable/history`

Returns the 20 most recent persisted generation runs (requires MongoDB).

### CRUD resources

Standard REST CRUD is available for the four entity types:

```
GET/POST      /api/divisions
GET/PUT/DELETE /api/divisions/:id
GET/POST      /api/subjects
GET/PUT/DELETE /api/subjects/:id
GET/POST      /api/faculty
GET/PUT/DELETE /api/faculty/:id
GET/POST      /api/classrooms
GET/PUT/DELETE /api/classrooms/:id
```

All bodies are validated with Zod; invalid input returns `400` with a `details`
array.

## Algorithm explanation

See **[APPROACH.md](./APPROACH.md)** for the full CSP/MRV/backtracking write-up.

## Testing

```bash
cd backend
npm test
```

Runs Jest against `src/tests/*.test.js`:

- `constraints.test.js` — every individual hard constraint (division/faculty/room
  conflict, capacity, lab requirement, availability).
- `preflight.test.js` — all four preflight checks (division capacity, faculty
  capacity, no suitable room, insufficient lab capacity).
- `solver.test.js` — valid dataset → `SUCCESS`; impossible dataset → not `SUCCESS`;
  independent final validation passes with zero violations; exact weekly frequency;
  no duplicate sessions.
- `api.test.js` — health check, sample/sample-conflict endpoints, generate endpoint,
  input validation (400 on bad payload), 404 on unknown routes.

> See `AI_USAGE_REPORT.md` for how these tests were validated in an environment
> without npm registry access.

## Demo instructions

1. Start MongoDB, then `npm run seed` (optional — only needed for the CRUD/history
   endpoints; the two demo buttons work without it).
2. Start the backend (`npm run dev` in `backend/`) and frontend (`npm run dev` in
   `frontend/`).
3. Open `http://localhost:5173`.
4. **Successful generation:** click **Generate Valid Demo** → banner shows `SUCCESS`,
   the grid populates with all 18 sessions.
5. **Impossible/conflicting generation:** click **Generate Conflict Demo** → banner
   shows `FAILED` with a list of diagnostics (`FACULTY_CAPACITY_EXCEEDED`,
   `NO_SUITABLE_ROOM`, `INSUFFICIENT_LAB_CAPACITY`, plus per-session reasons).
6. **Different views:** use the **By Division / By Faculty / By Room** switcher above
   the grid, and the dropdown next to it, to filter the same schedule by any entity.
7. **CSV export:** after a successful generation, click **Export CSV** to download
   `timetable.csv` (Day, Period, Division, Subject, Faculty, Classroom).

## Troubleshooting

- **Frontend loads but API calls fail / network errors:** make sure the backend is
  running on port 5000 (or update `frontend/vite.config.js`'s proxy target).
- **CRUD/history endpoints return empty or error:** these require MongoDB; check
  `MONGODB_URI` in `backend/.env` and that MongoDB is reachable. The sample/demo
  endpoints do **not** require MongoDB.
- **`npm run seed` fails to connect:** verify your `MONGODB_URI`, and that the
  MongoDB service is actually running (`mongod` locally, or that your Atlas IP
  allowlist includes your machine).
- **Solver seems slow / times out:** lower `timeConfig.maxSearchNodes` /
  `timeoutMs` won't make it faster, but raising them gives it more room on larger
  datasets; check the `statistics.searchNodes` / `backtracks` in the response to see
  how hard the search worked.
- **Port already in use:** change `PORT` in `backend/.env`, or the frontend's Vite
  port in `frontend/vite.config.js`.

## Important file explanations

- **`TimetableSolver.js`** — the CSP engine: builds one variable per required
  session, runs MRV variable selection + recursive backtracking with correct
  undo, and enforces search-node/timeout limits.
- **`ConstraintValidator.js`** — every hard constraint as a pure function, used
  both during search (candidate filtering) and after search (independent final
  validation).
- **`PreflightValidator.js`** — cheap up-front feasibility checks (division/faculty
  capacity, room suitability, lab capacity) that run before the expensive search.
- **`ScoringEngine.js`** — the soft constraint (subject distribution across days),
  used only to rank already-legal candidates.
- **`TimetableService.js`** — orchestrates preflight → solve → final validation →
  API response shape; the only module both the HTTP layer and the seed/demo scripts
  depend on.
- **`Dashboard.jsx`** — the main React page: demo buttons, summary cards, view
  switcher, CSV export, loading/empty/error states.
- **`TimetableGrid.jsx`** — renders the Day×Period grid and each session's
  subject/faculty/room/division.
