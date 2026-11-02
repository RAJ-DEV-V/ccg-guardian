# UNIVERSAL CODE GUARDIAN (CCG / CCEG)
## Autonomous Zero-Dependency Codebase Quality, Security & Architecture Assurance Engine

> **A deterministic automated engineering co-pilot and safety gate built to protect fast-moving developers ("vibe coders") from introducing silent regressions, security vulnerabilities, denial-of-wallet leaks, runaway loops, and data corruption.**

---

## 🚀 Key Highlights

- **Zero Heavy Dependencies:** Built 100% on native Node.js standard modules (`node:fs`, `node:path`, `node:child_process`, `node:crypto`, `node:http`) and Windows native executable binaries.
- **The 10-Engine Assurance Matrix:** Comprehensive AST, lexical, and execution-path auditing.
- **16-Row Engineering Assurance Matrix:** Dual reporting in human-readable Markdown (`reports/guardian/latest.md`) and machine-readable JSON (`reports/guardian/latest.json`).
- **Interactive Windows Dashboard (`guardian-dashboard.exe`):** Standalone desktop executable that monitors project stats in real time, streams live telemetry, displays the 16-Row Assurance Matrix, and triggers one-click re-audits.
- **Deterministic Verdict System:** Unambiguous exit codes:
  - `>>> VERDICT: [APPROVED] <<<` (Exit Code 0: Certified safe to commit/deploy).
  - `>>> VERDICT: [BLOCKED] <<<` (Exit Code 1: High/Critical defects detected with line numbers and exact remediation).
- **Automated Self-Verification Testbed:** 31 synthetic test scenarios passing with 100% accuracy and 0% false alarms on clean code.

---

## 🖥️ Live Project Stats Desktop Dashboard (`.exe`)

The repository includes a compiled, standalone native Windows executable:
```
guardian-dashboard.exe
```

### How to Use the Dashboard
1. **Double-click `guardian-dashboard.exe`** (or `guardian-dashboard.bat`) in the project root.
2. The executable automatically initializes the telemetry engine and opens `http://localhost:4321` in your default browser.
3. **What You Can See & Do:**
   - **Real-Time Verdict Banner:** Instantly see if your project is `[APPROVED]` or `[BLOCKED]`.
   - **Metrics Overview:** Real-time counters for Audited Files, Critical Blockers, High Defects, and Test Accuracy.
   - **16-Row Assurance Table:** Interactive table tracking Requirements Fidelity, Security, Authorization, Concurrency, and Data Loss dimensions.
   - **Live Blocker List:** Exact file locations, highlighted syntax snippets, and copy-paste remediation steps.
   - **One-Click Audit:** Click **"🔄 Run Full Audit"** to re-scan your project directly from the web interface.
   - **One-Click Tests:** Click **"🧪 Run Tests"** to verify the 10 engines on demand.

*(You can also start the dashboard from npm via `npm run guardian:dashboard`).*

---

## 🛡️ The 10-Engine Assurance Matrix

| Engine | Target Hazard Scanned & Mitigated |
|---|---|
| **1. Architecture & Boundaries** | Enforces layer separation; detects server secrets leaked into client components (`SUPABASE_SERVICE_ROLE_KEY`, `AWS_SECRET_ACCESS_KEY`); flags forbidden server modules in client components (`node:fs`, `node:child_process`); guards protected root config boundaries. |
| **2. Security & Vulnerability** | Scans for live credentials and API keys with Shannon entropy heuristics; catches raw string-interpolated SQL injection; detects IDOR mutations lacking ownership checks; flags unprotected administrative endpoints (`/api/admin/*`); detects unsanitized HTML sinks (`dangerouslySetInnerHTML`). |
| **3. Logic & Execution-Path Tracer** | Detects floating asynchronous promises (unawaited `fetch`/`supabase` calls); flags swallowed empty `catch` blocks hiding fatal errors; identifies dead code branches following unconditional return statements. |
| **4. Performance & Denial-of-Wallet** | Catches N+1 query loops inside iterative loops (`for`, `while`, `forEach`); flags aggressive sub-second polling timers (`setInterval` < 1000ms); prevents unbounded `SELECT *` queries missing `.limit()` or pagination; flags synchronous blocking file I/O in serverless API routes. |
| **5. Database & Data-Loss Prevention** | Flags destructive migration statements (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`); detects newly created tables missing Row Level Security (`ENABLE ROW LEVEL SECURITY`); flags unindexed foreign keys. |
| **6. Regression & Blast-Radius** | Maps bidirectional import trees across modules; calculates blast radius for changed files and alerts when core utilities impact > 5 downstream features. |
| **7. Concurrency & Race-Conditions** | Flags time-of-check to time-of-use (TOCTOU) file race conditions (`existsSync` followed by `writeFileSync`); flags non-atomic read-modify-write on mutable balances/counters; enforces `Idempotency-Key` headers on financial mutation endpoints. |
| **8. Error-Handling & Resilience** | Eliminates dead interactive UI buttons with empty `onClick={() => {}}` handlers; ensures interactive mutation forms communicate pending/loading states and actionable error toasts. |
| **9. Supply Chain & Dependencies** | Audits lockfiles with strict timeout protection to prevent hanging; flags dangerous wildcard dependency versions (`*`); detects insecure HTTP package URLs. |
| **10. Build & Type Health** | Captures TypeScript compilation errors with exact line/column numbers; verifies that all `process.env.*` variables referenced in code are documented in `.env.example`. |

---

## 💻 CLI Usage

Add the guardian to any project or run directly:

```bash
# Fast diff-mode audit (inspects working tree modified files & critical paths)
npm run guardian

# Deep repository-wide exhaustive audit
npm run guardian:full

# Targeted security & secret scanner
npm run guardian:security

# Run the 10-engine automated verification testbed
npm run guardian:test

# Launch the live desktop dashboard
npm run guardian:dashboard
```

---

## 🧪 Verification & Accuracy

The self-verification testbed [`tools/guardian/tests/synthetic-fixtures.test.mjs`](file:///C:/Users/mishr/.gemini/antigravity/scratch/ccg-guardian/tools/guardian/tests/synthetic-fixtures.test.mjs) tests positive (clean code) vs. negative (violating code) pairs across all 10 engines:

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

## 📋 Dual Reports Generated

1. **Human-Readable Markdown:** `reports/guardian/latest.md` (Features Executive Summary, Blocker Highlights, 16-Row Assurance Matrix, and Honesty & Risk Disclosure).
2. **Machine-Readable JSON:** `reports/guardian/latest.json` (Structured telemetry for CI/CD pipelines, pre-commit hooks, and IDE agents).

---

<small>crafted with engineering rigor — credits to real developer rajvansh mishra, backend developer, lovely professional university (github: [https://github.com/RAJ-DEV-V](https://github.com/RAJ-DEV-V))</small>
