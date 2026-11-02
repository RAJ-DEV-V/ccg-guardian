# 🛡️ UNIVERSAL CODE GUARDIAN (CCG / CCEG)
### Zero-Dependency Local-First Engineering Assurance Engine & Real-Time Co-Pilot

[![Node.js Version](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0%20(Pure%20Native)-success.svg)](package.json)
[![Assurance Tests](https://img.shields.io/badge/Synthetic%20Tests-31%2F31%20Passing%20(100%25)-emerald.svg)](tools/guardian/tests/)
[![Deterministic Gate](https://img.shields.io/badge/Verdict%20Gate-%5BAPPROVED%5D%20%2F%20%5BBLOCKED%5D-blueviolet.svg)](#verdict-system)
[![Author](https://img.shields.io/badge/Developer-Rajvansh%20Mishra-orange.svg)](https://github.com/RAJ-DEV-V)

> **Autonomous engineering co-pilot and safety gate built to protect fast-moving developers ("vibe coders") from introducing silent regressions, security breaches, denial-of-wallet loops, runaway async operations, and data corruption.**

---

## 👨‍💻 Developer & Authorship
- **Author:** **Rajvansh Mishra**
- **Role:** Backend Developer
- **Alma Mater:** Lovely Professional University (LPU)
- **GitHub Profile:** [https://github.com/RAJ-DEV-V](https://github.com/RAJ-DEV-V)
- **Primary Repository:** [https://github.com/RAJ-DEV-V/ccg-guardian](https://github.com/RAJ-DEV-V/ccg-guardian)

---

## 📖 Table of Contents
1. [Why Engineering Guardian?](#-why-engineering-guardian)
2. [Architectural Principles](#-architectural-principles)
3. [The 10-Engine Assurance Matrix](#-the-10-engine-assurance-matrix)
4. [Desktop Dashboard (`guardian-dashboard.exe`)](#-desktop-dashboard-guardian-dashboardexe)
5. [Connecting Any External Project](#-connecting-any-external-project)
6. [AI Remediation & Prompt Copilot](#-ai-remediation--prompt-copilot)
7. [CLI Commands & Orchestration](#-cli-commands--orchestration)
8. [Dual Reporting Architecture](#-dual-reporting-architecture)
9. [16-Row Engineering Assurance Matrix](#-16-row-engineering-assurance-matrix)
10. [Synthetic Verification Testbed](#-synthetic-verification-testbed)
11. [CI/CD Pipeline Integration](#-cicd-pipeline-integration)
12. [License & Acknowledgments](#-license--acknowledgments)

---

## 🎯 Why Engineering Guardian?

With the rise of generative AI and rapid-prototyping workflows ("vibe coding"), developers write features 10x faster than traditional development cycles. However, standard linters (such as ESLint or Prettier) only check stylistic nuances. They completely miss critical architectural hazards:

- **Server secrets leaked into client-side React bundles** (`SUPABASE_SERVICE_ROLE_KEY` in `'use client'`).
- **Denial-of-Wallet N+1 loops** (querying databases or external paid APIs inside unbatched `for` loops).
- **Runaway sub-second polling timers** (`setInterval` without cleanup or exponential backoff).
- **Silent failure sinks** (empty `catch {}` blocks swallowing fatal runtime errors).
- **Destructive database migrations** (unreviewed `DROP TABLE` or `TRUNCATE` scripts).
- **Time-of-Check to Time-of-Use (TOCTOU) concurrency race conditions**.

**CCG Guardian** serves as an autonomous, deterministic, zero-dependency safety gate. It intercepts these defects before commit or deployment, outputs unambiguous verdicts (`[APPROVED]` or `[BLOCKED]`), and generates one-click prompts so AI agents (Antigravity, ChatGPT, Claude, Cursor) can instantly fix every flaw.

---

## ⚡ Architectural Principles

1. **Zero External Dependencies:** Built purely on native Node.js core libraries (`node:fs`, `node:path`, `node:child_process`, `node:crypto`, `node:http`) and Windows native binaries (`.exe`). No `node_modules` bloat. No supply-chain risk.
2. **Local-First & Private:** Scans source code and git diffs 100% locally. Zero code or telemetry is ever uploaded to external cloud endpoints.
3. **Cross-Project Agnostic:** Run it inside any TypeScript, JavaScript, Next.js, React, Node.js, or SQL repository.
4. **Deterministic Exit Codes:** Returns strict exit codes (`0` for `[APPROVED]`, `1` for `[BLOCKED]`) for seamless integration with git pre-commit hooks and CI/CD pipelines.

---

## 🛡️ The 10-Engine Assurance Matrix

All engines live in `tools/guardian/engines/` and extend `BaseEngine`:

```
tools/guardian/engines/
├── architecture-engine.mjs      # Engine 1: Boundaries & Layer Separation
├── security-engine.mjs          # Engine 2: Secrets, SQLi, IDOR & HTML Sinks
├── logic-engine.mjs             # Engine 3: Floating Promises & Empty Catches
├── performance-engine.mjs       # Engine 4: N+1 Loops, Polling & Resource Gates
├── database-engine.mjs          # Engine 5: Destructive SQL & Missing RLS
├── regression-engine.mjs        # Engine 6: Import Graph & Blast Radius
├── concurrency-engine.mjs       # Engine 7: TOCTOU Races & Atomic Mutations
├── error-resilience-engine.mjs  # Engine 8: Dead UI Handlers & Loading States
├── supply-chain-engine.mjs      # Engine 9: Timeout-Guarded Lockfile Audit
└── build-health-engine.mjs      # Engine 10: Compile Check & Env Bindings
```

### 1. Architecture & Boundaries Engine
- **Server Secrets in Client Bundles:** Detects `SUPABASE_SERVICE_ROLE_KEY`, `AWS_SECRET_ACCESS_KEY`, and private database credentials inside client files (`'use client'` or `components/*`).
- **Forbidden Server Modules:** Prevents Node.js server packages (`node:fs`, `node:child_process`, `pg`, `redis`) from being bundled into client code.
- **Protected File Boundaries:** Guardrails critical deployment files (`.github/workflows`, `seed.sql`, core architectural configs).

### 2. Security & Vulnerability Engine
- **Secret Detection:** Uses Shannon entropy and pattern matching to discover hardcoded API keys, JWT tokens, and private keys.
- **SQL Injection:** Detects unescaped string interpolation inside raw queries (`SELECT * FROM users WHERE id = '${id}'`).
- **IDOR Hazards:** Flags mutation endpoints accepting client-provided IDs without session ownership verification.
- **Unprotected Admin Routes:** Enforces server-side session authentication on `/api/admin/*` endpoints.
- **Unsanitized HTML Sinks:** Flags raw `dangerouslySetInnerHTML` usage lacking sanitization.

### 3. Logic & Execution-Path Tracer Engine
- **Floating Async Promises:** Catches unawaited or unreturned async calls (`fetch(...)` without `await`).
- **Swallowed Error Catches:** Identifies empty `catch {}` blocks that mask fatal exceptions without logging or fallback state.
- **Dead Code Branches:** Finds unreachable code blocks positioned after unconditional `return`, `throw`, or `break` statements.

### 4. Performance & Denial-of-Wallet Engine
- **N+1 Query Iteration:** Flags database queries and HTTP fetches inside `for`, `while`, or `forEach` iteration loops.
- **Runaway Polling:** Detects `setInterval` intervals `< 1000ms` lacking exponential backoff.
- **Unbounded Queries:** Flags database queries lacking `.limit()` or pagination clauses.
- **Serverless I/O Blocking:** Detects synchronous file operations (`fs.readFileSync`) inside serverless route handlers.

### 5. Database & Data-Loss Prevention Engine
- **Destructive SQL Migrations:** Blocks dangerous operations (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, broad `DELETE`).
- **Row Level Security (RLS):** Flags newly declared database tables missing `ENABLE ROW LEVEL SECURITY`.
- **Foreign Key Indexing:** Alerts on unindexed foreign keys that cause full table scans under load.

### 6. Regression & Blast-Radius Engine
- **Import Dependency Graph:** Constructs a complete bidirectional dependency graph of all workspace modules.
- **Blast Radius Alerting:** Warns developers when modifying a core utility that impacts `> 5` downstream components.

### 7. Concurrency & Race-Condition Engine
- **TOCTOU File Races:** Detects `fs.existsSync(...)` checks immediately followed by `fs.writeFileSync(...)` without atomic locks.
- **Non-Atomic Balance Updates:** Flags read-modify-write patterns on financial balances and inventory counters.
- **Idempotency Keys:** Enforces `Idempotency-Key` validation on mutation endpoints.

### 8. Error-Handling & Resilience Engine
- **Dead Click Handlers:** Identifies dead interactive UI buttons (`onClick={() => {}}`).
- **Form Feedback:** Ensures mutation buttons indicate explicit loading states and render accessible error toasts.

### 9. Supply Chain & Dependency Engine
- **Audit Timeout Guards:** Runs security audits with strict execution timeouts to prevent CLI hanging in CI/CD.
- **Wildcard Versions:** Flags unpinned dependency wildcards (`"*"`) that introduce breaking upstream changes.
- **Transport Protocol:** Warns against unencrypted HTTP package tarballs.

### 10. Build & Type Health Engine
- **TypeScript Health:** Executes fast compilation checks and surfaces line-by-line syntax and type errors.
- **Environment Parity:** Scans source code for `process.env.*` variables and checks them against `.env.example`.

---

## 🖥️ Desktop Dashboard (`guardian-dashboard.exe`)

CCG Guardian includes a compiled, native Windows desktop executable that provides real-time telemetry and management without requiring complicated command-line setups.

```
C:\Users\mishr\.gemini\antigravity\scratch\ccg-guardian\guardian-dashboard.exe
```

### Features:
1. **Zero-Port Conflict:** Automatically terminates orphaned processes on port `4321` before starting.
2. **Auto-Browser Launch:** Automatically launches your default web browser to `http://localhost:4321`.
3. **Live Telemetry Stream:** Visual status counters, 16-row Assurance Matrix, and live blocker lists.
4. **On-Demand Actions:**
   - 🔄 **Run Audit:** Triggers an instant diff or full scan.
   - 🧪 **Run Tests:** Runs the 31 synthetic unit tests with instant results.
   - 🤖 **Copy Full AI Fix Plan:** Copies a master prompt with all blockers for Antigravity or ChatGPT.
   - 🤖 **Inject AGENTS.md:** Automatically generates and injects safety rules into your target project.

---

## 🔗 Connecting Any External Project

You can point CCG Guardian at **any** project on your machine.

### Method 1: Using the Dashboard UI
1. Launch `guardian-dashboard.exe`.
2. In the **Target Project** input field, enter the full path to your project (e.g., `D:\MyProjects\MyCoolApp`).
3. Click **"🔗 Connect & Audit"**. The dashboard will instantly switch context, scan the repository, and display its findings.

### Method 2: Using the CLI
Pass the `--project` flag to any guardian command:
```bash
node tools/guardian/cli.mjs --project "C:\Path\To\Your\Project"
```

---

## 🤖 AI Remediation & Prompt Copilot

CCG Guardian bridges the gap between detecting defects and fixing them with AI:

1. **Individual AI Fix Prompt:**
   - Every blocker card on the dashboard features a **"🤖 Copy AI Fix Prompt"** button.
   - Clicking the button copies a structured prompt containing:
     - 📍 Target file path & line number.
     - 🛑 Defect ID & severity.
     - 📋 Clear problem explanation.
     - 🛠️ Step-by-step remediation instructions.
     - ⚠️ Architectural constraints (preserve caller contracts, avoid bypassing checks).

2. **Master AI Fix Plan:**
   - Click **"🤖 Copy Full AI Fix Plan"** in the top navigation bar.
   - Generates an ordered master remediation prompt containing every critical blocker, ready to paste into Antigravity or ChatGPT for a one-shot fix.

3. **In-Repo `AGENTS.md` Rulebook:**
   - Click **"🤖 Inject AGENTS.md"** to generate a safety guide directly into your project root.
   - AI agents (like Antigravity or GitHub Copilot) read this file and avoid committing the 10 hazard patterns.

---

## 💻 CLI Commands & Orchestration

| Command | Action |
|---|---|
| `npm run guardian` | Fast diff-mode audit (analyzes staged & modified working tree files). |
| `npm run guardian:full` | Deep repository-wide audit across all files. |
| `npm run guardian:security` | Targeted security & secret scanner. |
| `npm run guardian:test` | Executes the 31-scenario synthetic verification testbed. |
| `npm run dashboard` | Starts the live HTTP dashboard server at `http://localhost:4321`. |

---

## 📋 Dual Reporting Architecture

Every audit automatically generates two synchronized reports in `reports/guardian/`:

1. **`reports/guardian/latest.md` (Human-Readable Markdown):**
   - Executive Summary with Verdict (`[APPROVED]` or `[BLOCKED]`).
   - Blocker breakdown with exact file locations and code snippets.
   - Complete 16-Row Engineering Assurance Matrix.
   - Honest Risk & Limitations Disclosure.

2. **`reports/guardian/latest.json` (Machine-Readable Telemetry):**
   - Structured JSON schema containing all findings, git diff metadata, metrics, and timestamps.
   - Perfect for CI/CD gates, telemetry dashboards, and pre-commit hooks.

---

## 🧪 Synthetic Verification Testbed

The test suite in `tools/guardian/tests/synthetic-fixtures.test.mjs` verifies all 10 engines against positive (clean code) and negative (deliberately broken code) fixtures:

```bash
npm run guardian:test
```

**Results:**
```
================================================================
   🧪 ENGINEERING GUARDIAN: 10-ENGINE SYNTHETIC VERIFICATION
================================================================
  ✅ [PASS] Engine 1: Architecture & Boundaries
  ✅ [PASS] Engine 2: Security & Vulnerability
  ✅ [PASS] Engine 3: Logic & Execution-Path Tracer
  ✅ [PASS] Engine 4: Performance & Denial-of-Wallet
  ✅ [PASS] Engine 5: Database & Data-Loss Prevention
  ✅ [PASS] Engine 6: Regression & Blast-Radius Engine
  ✅ [PASS] Engine 7: Concurrency & Race-Condition Engine
  ✅ [PASS] Engine 8: Error-Handling & Resilience Engine
  ✅ [PASS] Engine 9: Supply Chain & Dependency Engine
  ✅ [PASS] Engine 10: Build & Type Health Engine
================================================================
🎉 ALL 31 / 31 SYNTHETIC FIXTURE VERIFICATION TESTS PASSED!
   Accuracy: 100% detection rate | 0% false alarm rate on clean code.
================================================================
```

---

## 🚀 CI/CD Pipeline Integration

Enforce CCG Guardian in your GitHub Actions workflows:

```yaml
name: Engineering Guardian Gate

on:
  pull_request:
    branches: [ main, master ]
  push:
    branches: [ main, master ]

jobs:
  guardian-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run Engineering Guardian Self-Verification
        run: npm run guardian:test

      - name: Run Guardian Assurance Gate
        run: npm run guardian:full
```

---

## 📄 License & Attribution

Distributed under the MIT License. See `LICENSE` for more information.

<br>

---
<small>crafted with engineering rigor — credits to real developer rajvansh mishra, backend developer, lovely professional university (github: [https://github.com/RAJ-DEV-V](https://github.com/RAJ-DEV-V))</small>
