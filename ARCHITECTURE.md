# Arkhitect SaaS Architecture

## Overview

Arkhitect is a validation SaaS that lets users configure Bubble.io API credentials, describe test suites via chat, review AI-generated assumptions, run tests against real data (e.g., Order ID), and view step-by-step trace results. The UI is minimalist: centered single column (60% width) with two main tabs. Code is generated server-side by the LLM and never exposed to the user.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router |
| UI | Minimalist custom CSS, no heavy framework |
| Backend | Node.js, Express |
| Database | Supabase (PostgreSQL) |
| Code Execution | isolated-vm (V8 isolate sandbox) |
| External APIs | Bubble Data API, Buildprint MCP |

---

## Application Structure

```
arkhitect/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx       # 60% centered column
│   │   │   ├── Setup.jsx        # Onboarding tab
│   │   │   ├── Auth.jsx         # Authentication
│   │   │   ├── Validator.jsx    # Main validator orchestrator
│   │   │   └── Validator/
│   │   │       ├── ChatPanel.jsx          # LLM chat interface (Edit/Ask/Create)
│   │   │       ├── RecordFlow.jsx         # Record flow via Playwright, Buildprint MCP
│   │   │       ├── TestRunner.jsx         # Run tests, display results
│   │   │       ├── StepTrace.jsx          # Step-by-step trace visualization
│   │   │       ├── ValidatorHeader.jsx    # Suite selector + entity ID
│   │   │       └── VersionHistory.jsx     # Code version management
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── lib/
│   │   │   └── supabase.js
│   │   ├── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── server/                 # Express backend
│   ├── db/                 # Supabase + migrations
│   │   ├── supabase.js
│   │   ├── init.sql            # Full schema (fresh installs)
│   │   ├── migrate-add-rls.sql # Upgrade migration (existing DBs)
│   │   ├── migrate.js          # Runs init.sql then migrations
│   │   └── seed.js
│   ├── middleware/
│   │   └── auth.js         # JWT auth middleware
│   ├── routes/
│   │   ├── config.js       # CRUD for setup/credentials, Buildprint apps
│   │   ├── testSuites.js   # CRUD for test suites
│   │   ├── testRuns.js     # Run tests, store results
│   │   ├── ai.js           # LLM generate/edit/ask
│   │   ├── chat.js         # Chat message handling (edit/ask/create)
│   │   ├── codeVersions.js # Version history
│   │   └── recorder.js     # Recording flow (Playwright + Buildprint MCP)
│   ├── services/
│   │   ├── bubbleClient.js # Bubble API calls (server-side)
│   │   ├── testRunner.js   # Test execution via isolated-vm
│   │   ├── llm.js          # LLM integration (code generation)
│   │   ├── buildprint.js   # Buildprint MCP integration
│   │   └── recorder.js     # Playwright codegen recording
│   ├── index.js
│   └── package.json
└── ARCHITECTURE.md
```

---

## Database Schema (Supabase / PostgreSQL)

All tables include `user_id UUID DEFAULT auth.uid()` for multi-tenant RLS. Row Level Security is enabled on every table; users can only access their own rows.

### `configs`

Stores per-user configuration (key-value). UNIQUE constraint on `(key, user_id)`.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| key | VARCHAR | e.g. `bubble_api_base`, `bubble_api_token`, `llm_api_key`, `llm_model` |
| value | TEXT | Encrypted or plain |
| user_id | UUID | FK → auth.users, DEFAULT auth.uid() |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `test_suites`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | e.g. "Order Validation", "Reporting Daily" |
| description | TEXT | Optional |
| calculator_code | TEXT | LLM-generated JavaScript test logic (internal, never sent to client) |
| assumptions | JSONB | Last confirmed assumptions array |
| logic_md | TEXT | LOGIC.md content |
| run_order_tests | BOOLEAN | Feature flag |
| run_reporting_daily_tests | BOOLEAN | Feature flag |
| user_id | UUID | FK → auth.users, DEFAULT auth.uid() |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `test_runs`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| test_suite_id | UUID | FK → test_suites |
| entity_id | VARCHAR | e.g. Order ID |
| status | VARCHAR | `pending`, `running`, `passed`, `failed`, `error` |
| logs | TEXT | Console output from execution |
| expected_vs_received | JSONB | Array of `{ label, expected, received, pass }` |
| trace_steps | JSONB | Array of step trace objects |
| passed_count | INT | |
| failed_count | INT | |
| error_message | TEXT | If execution errored |
| user_id | UUID | FK → auth.users, DEFAULT auth.uid() |
| created_at | TIMESTAMPTZ | |

### `code_versions`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| test_suite_id | UUID | FK → test_suites |
| calculator_code | TEXT | Snapshot of code at this version |
| version_number | INT | Auto-incremented per suite |
| summary | TEXT | Optional summary |
| change_description | TEXT | What changed |
| created_by | VARCHAR | "ai" or "user" |
| user_id | UUID | FK → auth.users, DEFAULT auth.uid() |
| created_at | TIMESTAMPTZ | |

### `chat_messages`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| test_suite_id | UUID | FK → test_suites |
| role | VARCHAR | "user" or "assistant" |
| content | TEXT | Message text |
| mode | VARCHAR | "edit" or "ask" |
| metadata | JSONB | Optional (changeDescription, etc.) |
| user_id | UUID | FK → auth.users, DEFAULT auth.uid() |
| created_at | TIMESTAMPTZ | |

---

## API Endpoints

### Config

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/config | Get all config keys |
| POST | /api/config/batch | Upsert config batch |

### Test Suites

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/test-suites | List all suites |
| POST | /api/test-suites | Create suite |
| GET | /api/test-suites/:id | Get one suite |
| PUT | /api/test-suites/:id | Update suite |
| DELETE | /api/test-suites/:id | Delete suite |

### Test Runs

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/test-runs | Run test (suite_id, entity_id) → isolated-vm execution |
| GET | /api/test-runs | List runs (optional: suite_id filter) |
| GET | /api/test-runs/:id | Get run result |

### AI / LLM

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/ai/generate | Generate test code from prompt |
| POST | /api/ai/edit | Edit code (reads from DB via suiteId) |
| POST | /api/ai/ask | Ask question about test code |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/chat/:suiteId | Get chat messages |
| POST | /api/chat/:suiteId/send | Send message (edit/ask/create mode) |

### Code Versions

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/test-suites/:id/versions | List versions |
| GET | /api/test-suites/:id/versions/:vid | Get specific version |
| POST | /api/test-suites/:id/versions/:vid/restore | Restore version |

### Recorder

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/recorder/start | Start Playwright recording (suiteId) |
| GET | /api/recorder/:sessionId/events | SSE stream for recording status |
| POST | /api/recorder/:sessionId/stop | Stop recording |
| POST | /api/recorder/:sessionId/analyze | Analyze recording with Buildprint MCP |

---

## UI Flow

### Tab 1: Setup / Onboarding

- Form fields:
  - Bubble API Base URL (required)
  - Bubble API Token (required)
  - LLM API Base URL (required)
  - LLM API Key (required)
  - LLM Model (required)
- Save → stored in `configs` table.

### Tab 2: Validator

- **Header**: Test Suite dropdown, Entity ID input, Add Suite button.
- **Left Panel**: RecordFlow (record Bubble app) + ChatPanel (Edit/Ask/Create) + VersionHistory
- **Right Panel**: TestRunner + StepTrace

#### User Flow

1. User records a flow (RecordFlow) or describes the test in ChatPanel (Edit mode)
2. LLM generates test code (server-side, never shown to user)
3. User runs test with an Entity ID
4. StepTrace shows fetch → calculation → assertion steps
5. User verifies results, provides feedback if needed

---

## Data Flow: Running a Test

```
User selects suite + entity ID, clicks Run
    → POST /api/test-runs { suite_id, entity_id }
    → Server loads config (Bubble base, token)
    → Server loads test_suites.calculator_code
    → Creates isolated-vm V8 isolate (128MB memory limit)
    → Injects: getThing, searchThings, ENTITY_ID via ivm.Callback bridges
    → Executes code in sandbox with 30s timeout
    → Script outputs __ARKHITECT_RESULT__ + __TRACE__ via captured console.log
    → Server parses stdout, updates test_runs
    → Frontend polls /api/test-runs/:id until status != running
```

---

## Test Execution (isolated-vm)

- **Sandbox**: Each test runs in a fresh V8 isolate with 128MB memory limit and 30s timeout
- **Bubble API bridging**: `getThing` and `searchThings` are async `ivm.Callback` instances that delegate HTTP requests to the host Node.js process via `bubbleClient.js`
- **Console capture**: `console.log` is shimmed to capture all output, from which `__TRACE__` and `__ARKHITECT_RESULT__` lines are parsed
- **Security**: The isolate has no access to Node.js APIs, filesystem, or network — all external I/O is mediated through explicit callbacks
- **Node.js requirement**: Server must be started with `--no-node-snapshot` flag (Node.js 20+)

---

## Security Considerations

- Never expose Bubble/LLM keys to frontend.
- All API calls go through backend with JWT auth.
- Test code runs in isolated V8 sandbox (isolated-vm) with memory and time limits.
- Code is LLM-generated and never user-editable — no direct code injection surface.
- Encrypt sensitive config at rest (future).
