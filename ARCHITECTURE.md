# Arkhitect SaaS Architecture

## Overview

Arkhitect is a validation SaaS that lets users configure Bubble.io API credentials, define test suites with JavaScript calculator logic, run tests against real data (e.g., Order ID), and maintain a LOGIC.md document. The UI is minimalist: centered single column (60% width) with two main tabs and Validator sub-tabs.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, React Router |
| UI | Minimalist custom CSS, no heavy framework |
| Editor | Monaco Editor (minimal feature set) |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| External APIs | Bubble Data API, Cursor Cloud Agents API, Judge0 CE |

---

## Application Structure

```
arkhitect/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx       # 60% centered column
│   │   │   ├── Tabs.jsx         # Main tabs: Setup | Validator
│   │   │   ├── Setup/           # Onboarding tab
│   │   │   ├── Validator/
│   │   │   │   ├── TestRunner/  # Select suite, entity ID, run, logs, pass/fail
│   │   │   │   ├── TestEditor/  # Monaco + Cursor AI chat
│   │   │   │   └── Logic/       # LOGIC.md display + sync
│   │   │   └── ...
│   │   ├── api/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── server/                 # Express backend
│   ├── db/                 # PostgreSQL + migrations
│   ├── routes/
│   │   ├── config.js       # CRUD for setup/credentials
│   │   ├── testSuites.js   # CRUD for test suites
│   │   ├── testRuns.js     # Run tests, store results
│   │   ├── execute.js      # Judge0 code execution
│   │   └── cursor.js       # Cursor Cloud Agents API proxy
│   ├── services/
│   │   ├── bubbleClient.js # Bubble API calls (server-side)
│   │   ├── judge0.js       # Judge0 integration
│   │   └── cursorAgent.js  # Cursor API integration
│   └── index.js
├── shared/                 # Logic shared between legacy and new
│   └── orderCalculator.js  # Can be bundled for Judge0 execution
└── ARCHITECTURE.md
```

---

## Database Schema (PostgreSQL)

### `configs`

Stores workspace-level configuration (single row or key-value per workspace).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| key | VARCHAR | e.g. `bubble_api_base`, `bubble_api_token`, `cursor_api_key`, `judge0_api_key` |
| value | TEXT | Encrypted or plain (use env-based encryption in production) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

*For MVP: single-workspace; key-value table. For SaaS: add `workspace_id`.*

### `test_suites`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | e.g. "Order Validation", "Reporting Daily" |
| description | TEXT | Optional |
| calculator_code | TEXT | JavaScript logic (bundle of bubbleClient + calculator) |
| logic_md | TEXT | LOGIC.md content |
| run_order_tests | BOOLEAN | Feature flag (order suite) |
| run_reporting_daily_tests | BOOLEAN | Feature flag (reporting suite) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `test_runs`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| test_suite_id | UUID | FK → test_suites |
| entity_id | VARCHAR | e.g. Order ID (`1771672992747x483733468340289540`) |
| status | VARCHAR | `pending`, `running`, `passed`, `failed`, `error` |
| logs | TEXT | Console output from execution |
| expected_vs_received | JSONB | Array of `{ label, expected, received, pass }` |
| passed_count | INT | |
| failed_count | INT | |
| error_message | TEXT | If execution errored |
| created_at | TIMESTAMPTZ | |

---

## API Endpoints

### Config

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/config | Get all config keys |
| PUT | /api/config | Upsert config (key-value) |

### Test Suites

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/test-suites | List all suites |
| POST | /api/test-suites | Create suite |
| GET | /api/test-suites/:id | Get one suite |
| PUT | /api/test-suites/:id | Update suite (calculator_code, logic_md) |
| DELETE | /api/test-suites/:id | Delete suite |

### Test Runs

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/test-runs | Run test (suite_id, entity_id) → triggers Judge0 |
| GET | /api/test-runs | List runs (optional: suite_id filter) |
| GET | /api/test-runs/:id | Get run result |

### Execute (Judge0)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/execute | Run calculator code via Judge0, return stdout/stderr |

### Cursor Agent

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/cursor/agent | Launch Cloud Agent (prompt, repo/context) |
| GET | /api/cursor/agent/:id | Get agent status |
| POST | /api/cursor/agent/:id/followup | Add follow-up |

---

## UI Flow

### Tab 1: Setup / Onboarding

- Form fields:
  - Bubble API Base URL (required)
  - Bubble API Token (required)
  - Cursor API Key (optional, for Test Editor AI)
  - GitHub Repo URL (optional, required for Cursor agent - user-provided repo)
  - Judge0 API Key (optional; public Judge0 CE has rate limits)
- Save → stored in `configs` table. Bubble credentials are required for test execution.

### Tab 2: Validator

- **Shared header** (above sub-tabs): Test Suite dropdown, Entity ID (Order ID) input, Add Suite button.
- Selecting suite / entity applies across all sub-tabs.

#### Sub-tab 1: Test Runner

1. Button: Run Test (uses suite + entity ID from header).
2. Backend: loads calculator_code, injects Bubble helpers + entity ID + config, sends to Judge0.
3. Display: Pass/fail summary, Expected vs Received table, Logs.

#### Sub-tab 2: Test Editor

1. Monaco editor: single calculator file per suite (uses getThing, searchThings, ENTITY_ID).
2. Save → updates `test_suites.calculator_code`.
3. "Run Code" button → Judge0 execution → inline output.
4. Cursor AI: user prompt + GitHub repo URL → launches Cursor Cloud Agent on user-provided repo. User applies changes manually.

#### Sub-tab 3: Logic

1. Markdown preview of `logic_md` (from `test_suites.logic_md`).
2. Edit toggle: textarea for editing, rendered Markdown for view.

---

## Data Flow: Running a Test

```
User selects suite + entity ID (from header), clicks Run
    → POST /api/test-runs { suite_id, entity_id }
    → Server loads config from configs table (Bubble base, token - no .env fallback)
    → Server loads test_suites.calculator_code
    → Injects: getThing, searchThings, ENTITY_ID, BUBBLE_BASE, BUBBLE_TOKEN (fetch-based helpers)
    → Judge0 runs script (language_id: 63)
    → Script outputs __ARKHITECT_RESULT__ + JSON with results, passed, failed
    → Server parses stdout, updates test_runs
    → Frontend polls /api/test-runs/:id until status != running
```

---

## Judge0 Integration

- **Language**: JavaScript (Node.js), `language_id: 63`.
- **Credentials**: From `configs` table only (Setup tab). No .env fallback for Bubble.
- **Injection**: Server prepends `getThing`, `searchThings`, `ENTITY_ID`, `BUBBLE_BASE`, `BUBBLE_TOKEN` (fetch-based). User code uses these to call Bubble API.
- **Output**: User code must end with `console.log("__ARKHITECT_RESULT__" + JSON.stringify({ results, passed, failed }))`.

---

## Cursor Cloud Agents API

- **User-provided repo**: User adds GitHub repo URL in Setup. Cursor agent works on that repo.
- User types prompt in Test Editor → backend calls `POST https://api.cursor.com/v0/agents` with:
  - `prompt.text`: user instruction
  - `source.repository`: from configs (`cursor_github_repo`) or request body
- Agent modifies files in the repo. User applies changes manually (copy back to Test Editor or sync repo).

---

## Security Considerations

- Never expose Bubble/Cursor/Judge0 keys to frontend.
- All API calls go through backend.
- Encrypt sensitive config at rest (future).
- Rate-limit Judge0 and Cursor proxy endpoints.

---

## Migration from Current Codebase

| Legacy | New |
|--------|-----|
| testConfig.js | `configs` table + Setup UI |
| orderCalculator.js | Logic inlined in `server/db/templates/orderValidation.js.txt`; seed loads it into `calculator_code` |
| bubbleClient.js | Fetch-based helpers injected by server before Judge0 execution |
| order.test.js, reportingDaily.test.js | Removed. Logic in seeded templates |
| LOGIC.md | `test_suites.logic_md` (Markdown preview in Logic tab) |
