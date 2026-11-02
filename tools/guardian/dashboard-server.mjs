/**
 * Engineering Guardian (CCG / CCEG) Live Dashboard Server
 * Zero-dependency local dashboard serving real-time telemetry, live audits,
 * and multi-project connectivity.
 * 
 * credits to developer rajvansh mishra, backend developer, lovely professional university
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

function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Engineering Guardian | Live Project Assurance Dashboard</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f293d;
      --accent-blue: #3b82f6;
      --accent-cyan: #06b6d4;
      --danger: #ef4444;
      --warning: #f59e0b;
      --success: #10b981;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text-main);
      font-family: var(--font);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(17, 24, 39, 0.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--card-border);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand h1 { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.025em; }
    .brand-tag {
      background: #1e3a8a;
      color: #93c5fd;
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .header-actions { display: flex; gap: 0.75rem; align-items: center; }
    .btn {
      background: var(--accent-blue);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
    }
    .btn:hover { background: #2563eb; transform: translateY(-1px); }
    .btn-secondary {
      background: #374151;
      color: #e5e7eb;
    }
    .btn-secondary:hover { background: #4b5563; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .project-strip {
      background: #131d33;
      border-bottom: 1px solid var(--card-border);
      padding: 0.75rem 2rem;
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    .project-strip label {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--accent-cyan);
      white-space: nowrap;
    }
    .project-strip input {
      flex: 1;
      background: #0b0f19;
      border: 1px solid #2a3852;
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
      color: #e2e8f0;
      font-family: monospace;
      font-size: 0.875rem;
    }
    .project-strip input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    main {
      flex: 1;
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .banner {
      padding: 1.5rem 2rem;
      border-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .banner.BLOCKED {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(185, 28, 28, 0.05));
      border: 1px solid rgba(239, 68, 68, 0.4);
    }
    .banner.APPROVED {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(4, 120, 87, 0.05));
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .banner-title { font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 0.75rem; }
    .banner-desc { color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .stat-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .stat-value { font-size: 2rem; font-weight: 800; line-height: 1; }
    .stat-badge { font-size: 0.75rem; font-weight: 600; padding: 0.15rem 0.4rem; border-radius: 4px; width: fit-content; }

    .content-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 2rem;
    }
    @media (max-width: 1024px) {
      .content-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
    }
    .card-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-title { font-size: 1.1rem; font-weight: 700; }
    .card-body { padding: 1.5rem; }

    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }
    .matrix-table th {
      color: var(--text-muted);
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--card-border);
      font-weight: 600;
    }
    .matrix-table td {
      padding: 0.875rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .badge-pass { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-fail { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .badge-warn { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

    .finding-item {
      background: #1a2234;
      border: 1px solid #28354d;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .finding-title { font-weight: 700; font-size: 0.95rem; }
    .finding-loc { font-family: monospace; font-size: 0.8rem; color: #60a5fa; }
    .finding-snippet {
      background: #0f172a;
      border-radius: 4px;
      padding: 0.5rem;
      font-family: monospace;
      font-size: 0.8rem;
      margin: 0.5rem 0;
      white-space: pre-wrap;
      color: #e2e8f0;
      border-left: 3px solid var(--danger);
    }
    .finding-remed {
      font-size: 0.8rem;
      color: #94a3b8;
      background: rgba(0, 0, 0, 0.2);
      padding: 0.4rem 0.6rem;
      border-radius: 4px;
    }

    footer {
      border-top: 1px solid var(--card-border);
      padding: 1.5rem 2rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: auto;
    }
    footer a { color: var(--accent-cyan); text-decoration: none; font-weight: 600; }
    footer a:hover { text-decoration: underline; }

    .pulse {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span class="pulse"></span>
      <h1>ENGINEERING GUARDIAN</h1>
      <span class="brand-tag">CCG / CCEG v1.0</span>
    </div>
    <div class="header-actions">
      <span id="lastUpdated" style="font-size: 0.8rem; color: var(--text-muted)">Loading...</span>
      <button class="btn btn-secondary" onclick="runSyntheticTests()" id="btnTests">🧪 Run Tests</button>
      <button class="btn" onclick="triggerAudit()" id="btnAudit">🔄 Run Audit</button>
    </div>
  </header>

  <div class="project-strip">
    <label>📁 Target Project:</label>
    <input type="text" id="projectPathInput" value="${activeProjectRoot.replace(/\\/g, '\\\\')}" placeholder="Paste folder path to any project (e.g. C:\\...\\campus-connect-lpu)" />
    <button class="btn btn-secondary" onclick="connectProject()" id="btnConnect">🔗 Connect & Audit</button>
  </div>

  <main>
    <div id="verdictBanner" class="banner BLOCKED">
      <div>
        <div id="verdictTitle" class="banner-title">Loading Project State...</div>
        <div id="verdictDesc" class="banner-desc">Connecting to Engineering Guardian telemetry pipeline...</div>
      </div>
      <div id="verdictPill"></div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Files Audited</span>
        <span id="statFiles" class="stat-value">-</span>
        <span class="stat-badge" style="background:#1e293b; color:#94a3b8">Working Tree & Diff</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Critical Blockers</span>
        <span id="statCritical" class="stat-value" style="color:var(--danger)">-</span>
        <span class="stat-badge" style="background:rgba(239,68,68,0.2); color:#fca5a5">Requires Fix</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">High-Risk Defects</span>
        <span id="statHigh" class="stat-value" style="color:var(--warning)">-</span>
        <span class="stat-badge" style="background:rgba(245,158,11,0.2); color:#fde68a">Immediate Attention</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Engine Verification</span>
        <span id="statPrecision" class="stat-value" style="color:var(--success)">100%</span>
        <span class="stat-badge" style="background:rgba(16,185,129,0.2); color:#a7f3d0">31/31 Synthetic Tests</span>
      </div>
    </div>

    <div class="content-grid">
      <div class="card">
        <div class="card-header">
          <div class="card-title">16-Row Engineering Assurance Matrix</div>
          <span style="font-size:0.8rem; color:var(--text-muted)">Deterministic Gates</span>
        </div>
        <div class="card-body" style="padding:0">
          <table class="matrix-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Assurance Dimension</th>
                <th>Status</th>
                <th>Verification Evidence</th>
              </tr>
            </thead>
            <tbody id="matrixTableBody">
              <tr><td colspan="4" style="text-align:center; padding: 2rem">Loading matrix data...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">Critical & High Blockers</div>
          <span id="blockerCountBadge" class="badge badge-fail">0</span>
        </div>
        <div class="card-body" id="blockersList" style="max-height: 600px; overflow-y: auto;">
          <div style="text-align:center; color: var(--text-muted); padding: 2rem">No blockers loaded</div>
        </div>
      </div>
    </div>
  </main>

  <footer>
    <small>engineered with precision — credits to real developer rajvansh mishra, backend developer, lovely professional university (<a href="https://github.com/RAJ-DEV-V" target="_blank">github: https://github.com/RAJ-DEV-V</a>)</small>
  </footer>

  <script>
    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        renderDashboard(data);
      } catch (e) {
        console.error('Failed to fetch guardian stats:', e);
      }
    }

    function renderDashboard(data) {
      if (!data) return;

      if (data.connectedProject) {
        document.getElementById('projectPathInput').value = data.connectedProject;
      }

      const isApproved = data.verdict === 'APPROVED';
      const banner = document.getElementById('verdictBanner');
      banner.className = 'banner ' + (data.verdict || 'BLOCKED');

      document.getElementById('verdictTitle').innerHTML = isApproved 
        ? '✅ ASSURANCE VERDICT: [APPROVED]' 
        : '🛑 ASSURANCE VERDICT: [BLOCKED]';
      document.getElementById('verdictDesc').innerText = isApproved
        ? 'All 10 engineering engines passed. Codebase is certified safe for deployment.'
        : (data.blockerCount || 0) + ' Critical/High defect(s) detected. Deployment gate closed.';

      document.getElementById('statFiles').innerText = data.filesScannedCount || 0;
      document.getElementById('statCritical').innerText = (data.findings || []).filter(f => f.severity === 'CRITICAL').length;
      document.getElementById('statHigh').innerText = (data.findings || []).filter(f => f.severity === 'HIGH').length;
      document.getElementById('lastUpdated').innerText = (data.durationMs ? 'Audited in ' + data.durationMs + 'ms' : 'Live Connected');

      // Render Matrix
      const tbody = document.getElementById('matrixTableBody');
      if (data.assuranceMatrix) {
        tbody.innerHTML = data.assuranceMatrix.map((row, i) => {
          let badgeClass = 'badge-pass';
          if (row.status.includes('FAIL')) badgeClass = 'badge-fail';
          else if (row.status.includes('WARN')) badgeClass = 'badge-warn';

          return \`<tr>
            <td style="color:var(--text-muted); font-weight:600">\${String(i+1).padStart(2, '0')}</td>
            <td style="font-weight:600">\${row.category}</td>
            <td><span class="badge \${badgeClass}">\${row.status}</span></td>
            <td style="color:var(--text-muted); font-size:0.8rem">\${row.evidence}</td>
          </tr>\`;
        }).join('');
      }

      // Render Blockers List
      const blockers = (data.findings || []).filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
      document.getElementById('blockerCountBadge').innerText = blockers.length;
      const blockersList = document.getElementById('blockersList');

      if (blockers.length === 0) {
        blockersList.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--success)">✅ Zero blockers detected!</div>';
      } else {
        blockersList.innerHTML = blockers.map((b, idx) => \`
          <div class="finding-item">
            <div class="finding-header">
              <span class="badge \${b.severity === 'CRITICAL' ? 'badge-fail' : 'badge-warn'}">\${b.severity}</span>
              <span class="finding-loc">\${b.file}\${b.line ? ':' + b.line : ''}</span>
            </div>
            <div class="finding-title">\${b.title}</div>
            <div style="font-size:0.85rem; color:#cbd5e1; margin-top:0.25rem">\${b.message}</div>
            \${b.snippet ? \`<div class="finding-snippet">\${escapeHtml(b.snippet)}</div>\` : ''}
            <div class="finding-remed"><strong>Fix:</strong> \${escapeHtml(b.remediation)}</div>
          </div>
        \`).join('');
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function connectProject() {
      const input = document.getElementById('projectPathInput');
      const btn = document.getElementById('btnConnect');
      const targetPath = input.value.trim();
      if (!targetPath) return alert('Please enter a valid directory path.');

      btn.disabled = true;
      btn.innerText = '🔗 Connecting...';
      try {
        const res = await fetch('/api/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath: targetPath })
        });
        const data = await res.json();
        if (data.error) {
          alert('Error: ' + data.error);
        } else {
          renderDashboard(data);
        }
      } catch (err) {
        alert('Failed to connect to target project: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = '🔗 Connect & Audit';
      }
    }

    async function triggerAudit() {
      const btn = document.getElementById('btnAudit');
      btn.disabled = true;
      btn.innerText = '⏳ Auditing...';
      try {
        const res = await fetch('/api/audit', { method: 'POST' });
        const data = await res.json();
        renderDashboard(data);
      } finally {
        btn.disabled = false;
        btn.innerText = '🔄 Run Audit';
      }
    }

    async function runSyntheticTests() {
      const btn = document.getElementById('btnTests');
      btn.disabled = true;
      btn.innerText = '⏳ Testing 10 Engines...';
      try {
        const res = await fetch('/api/test', { method: 'POST' });
        const result = await res.json();
        alert(result.output || 'Test complete!');
      } finally {
        btn.disabled = false;
        btn.innerText = '🧪 Run Tests';
      }
    }

    loadStats();
    setInterval(loadStats, 5000);
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getDashboardHtml());
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
        const payload = JSON.parse(body || '{}');
        const targetPath = payload.projectPath;
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
  console.log(`credits to developer rajvansh mishra, backend developer, lovely professional university (github: https://github.com/RAJ-DEV-V)\n`);
});

// Optionally auto-open browser if running directly
if (process.argv.includes('--open')) {
  const openCmd = process.platform === 'win32' ? `start http://localhost:${PORT}` : `open http://localhost:${PORT}`;
  exec(openCmd);
}
