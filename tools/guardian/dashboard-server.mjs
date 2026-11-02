/**
 * Engineering Guardian (CCG / CCEG) Live Dashboard Server
 * Zero-dependency local dashboard serving real-time telemetry, live audits,
 * multi-project connectivity, and one-click AI prompts for Antigravity & ChatGPT.
 * 
 * credits to real developer rajvansh mishra, backend developer, lovely professional university
 * github: https://github.com/RAJ-DEV-V
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec, execSync } from 'node:child_process';
import { GuardianOrchestrator } from './orchestrator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI project argument
const args = process.argv.slice(2);
let activeProjectRoot = path.resolve(__dirname, '../..');

const projectArgIdx = args.findIndex(a => a === '--project' || a === '-p');
if (projectArgIdx !== -1 && args[projectArgIdx + 1]) {
  activeProjectRoot = path.resolve(args[projectArgIdx + 1]);
} else {
  const positionalPath = args.find(a => !a.startsWith('-') && a !== '--open');
  if (positionalPath && fs.existsSync(positionalPath)) {
    activeProjectRoot = path.resolve(positionalPath);
  }
}

const PORT = process.env.PORT || 4321;

function getLatestReport(targetDir = activeProjectRoot) {
  const reportJsonPath = path.join(targetDir, 'reports/guardian/latest.json');
  if (fs.existsSync(reportJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
      data.connectedProject = targetDir;
      return data;
    } catch {
      return null;
    }
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  // Enforce zero caching so browsers always load live UI and telemetry
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    const htmlPath = path.join(__dirname, 'dashboard.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath, 'utf8'));
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('dashboard.html not found');
    }
    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/api/stats') {
    let report = getLatestReport(activeProjectRoot);
    if (!report) {
      // If no report exists yet, run an initial audit
      const orchestrator = new GuardianOrchestrator({ rootDir: activeProjectRoot });
      const auditResult = await orchestrator.audit({ mode: 'diff' });
      report = auditResult.reportData;
      report.connectedProject = activeProjectRoot;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(report));
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/project') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        let targetPath = '';
        try {
          const payload = JSON.parse(body || '{}');
          targetPath = payload.projectPath;
        } catch {
          const m = body.match(/projectPath["']?\s*:\s*["']([^"']+)["']/i);
          if (m) targetPath = m[1];
          else targetPath = body.trim().replace(/^"|"$/g, '');
        }

        if (!targetPath || !fs.existsSync(targetPath)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Directory not found: ${targetPath}` }));
          return;
        }

        activeProjectRoot = path.resolve(targetPath);
        console.log(`[Dashboard] Switched active project to: ${activeProjectRoot}`);

        const orchestrator = new GuardianOrchestrator({ rootDir: activeProjectRoot });
        const auditResult = await orchestrator.audit({ mode: 'diff' });
        const report = auditResult.reportData;
        report.connectedProject = activeProjectRoot;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(report));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/antigravity') {
    try {
      const agentsMdPath = path.join(activeProjectRoot, 'AGENTS.md');
      const rulesContent = `# ENGINEERING GUARDIAN (CCG) RULES FOR AI AGENTS (ANTIGRAVITY / COPILOT)

You are operating under the strict engineering safety gate enforced by Engineering Guardian (CCG / CCEG).
Every code change must adhere to the 10-Engine Assurance Matrix:

1. **Architecture & Boundaries:**
   - Never reference \`SUPABASE_SERVICE_ROLE_KEY\`, \`AWS_SECRET_ACCESS_KEY\`, or private database credentials in client components (\`'use client'\` or \`components/*\`).
   - Never import Node.js server modules (\`fs\`, \`child_process\`, \`pg\`) into client bundles.

2. **Security & Vulnerabilities:**
   - Never hardcode active credentials or sensitive API keys in source files.
   - Never interpolate user-controlled variables into raw SQL queries (use parameterized $1 or ORM builders).
   - Enforce server-side session authentication on all administrative endpoints (\`/api/admin/*\`).
   - Sanitize dynamic HTML using \`DOMPurify.sanitize(...)\` before using \`dangerouslySetInnerHTML\`.

3. **Logic & Execution Flow:**
   - Never leave asynchronous calls unawaited (floating promises).
   - Never leave empty \`catch {}\` blocks that swallow runtime errors without logging or fallback state.

4. **Performance & Denial-of-Wallet:**
   - Never place database queries or HTTP fetches inside iteration loops (N+1 queries). Batch with \`.in(...)\` or \`Promise.all\`.
   - Never use aggressive polling intervals (\`setInterval\` < 1000ms).
   - Always bound queries with pagination (\`.limit(...)\` or \`.range(...)\`).

5. **Database & Data Integrity:**
   - Never execute destructive SQL (\`DROP TABLE\`, \`TRUNCATE\`) in migrations.
   - Always enable Row Level Security on newly created tables (\`ENABLE ROW LEVEL SECURITY\`).

6. **Concurrency & Race Conditions:**
   - Avoid read-modify-write patterns on balances/counters without atomic SQL or database locks.
   - Enforce \`Idempotency-Key\` on payment and checkout routes.

7. **Verification Rule:**
   - Always run \`npm run guardian\` or check the Guardian Dashboard before declaring a task complete!

<small>crafted with engineering rigor — credits to real developer rajvansh mishra, backend developer, lovely professional university (github: https://github.com/RAJ-DEV-V)</small>
`;
      fs.writeFileSync(agentsMdPath, rulesContent, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `Injected AGENTS.md rules into ${activeProjectRoot}` }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/audit') {
    try {
      const orchestrator = new GuardianOrchestrator({ rootDir: activeProjectRoot });
      const auditResult = await orchestrator.audit({ mode: 'diff' });
      const report = auditResult.reportData;
      report.connectedProject = activeProjectRoot;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(report));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/api/test') {
    try {
      const orchestratorDir = path.resolve(__dirname);
      const testFile = path.join(orchestratorDir, 'tests/synthetic-fixtures.test.mjs');
      const out = execSync(`node "${testFile}"`, {
        encoding: 'utf8',
        timeout: 15000
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, output: out }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, output: err.stdout || err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n================================================================`);
  console.log(`  🛡️  ENGINEERING GUARDIAN DASHBOARD ACTIVE`);
  console.log(`  URL:             http://localhost:${PORT}`);
  console.log(`  Target Project:  ${activeProjectRoot}`);
  console.log(`================================================================`);
  console.log(`credits to real developer rajvansh mishra, backend developer, lovely professional university (github: https://github.com/RAJ-DEV-V)\n`);
});

// Optionally auto-open browser if running directly
if (process.argv.includes('--open')) {
  const openCmd = process.platform === 'win32' ? `start http://localhost:${PORT}` : `open http://localhost:${PORT}`;
  exec(openCmd);
}
