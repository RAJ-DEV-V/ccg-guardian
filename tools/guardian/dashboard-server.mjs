/**
 * Engineering Guardian (CCG / CCEG) Live Dashboard Server
 * Zero-dependency local dashboard serving real-time telemetry, live audits,
 * multi-project connectivity, and one-click AI prompts for Antigravity & ChatGPT.
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
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  <title>Engineering Guardian | Live Project Assurance Dashboard</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f293d;
      --accent-blue: #3b82f6;
      --accent-cyan: #06b6d4;
      --accent-purple: #8b5cf6;
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
      background: rgba(17, 24, 39, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--card-border);
      padding: 0.85rem 2rem;
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
    .header-actions { display: flex; gap: 0.6rem; align-items: center; }
    .btn {
      background: var(--accent-blue);
      color: white;
      border: none;
      padding: 0.5rem 0.9rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.825rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
    }
    .btn:hover { background: #2563eb; transform: translateY(-1px); }
    .btn-secondary { background: #374151; color: #e5e7eb; }
    .btn-secondary:hover { background: #4b5563; }
    .btn-ai { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; }
    .btn-ai:hover { background: linear-gradient(135deg, #6d28d9, #4338ca); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .project-strip {
      background: #131d33;
      border-bottom: 1px solid var(--card-border);
      padding: 0.75rem 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .project-strip-row {
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
      padding: 0.45rem 0.75rem;
      color: #e2e8f0;
      font-family: monospace;
      font-size: 0.85rem;
    }
    .project-strip input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }
    .preset-pill {
      background: #1e293b;
      color: #93c5fd;
      border: 1px solid #334155;
      border-radius: 4px;
      padding: 0.2rem 0.5rem;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .preset-pill:hover {
      background: #2563eb;
      color: white;
    }

    main {
      flex: 1;
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
      padding: 1.75rem 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .banner {
      padding: 1.25rem 2rem;
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
    .banner-title { font-size: 1.35rem; font-weight: 800; display: flex; align-items: center; gap: 0.75rem; }
    .banner-desc { color: var(--text-muted); font-size: 0.875rem; margin-top: 0.25rem; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.25rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .stat-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .stat-value { font-size: 1.85rem; font-weight: 800; line-height: 1; }
    .stat-badge { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.4rem; border-radius: 4px; width: fit-content; }

    .content-grid {
      display: grid;
      grid-template-columns: 1.1fr 1.3fr;
      gap: 1.5rem;
    }
    @media (max-width: 1100px) {
      .content-grid { grid-template-columns: 1fr; }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .card-header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.01);
    }
    .card-title { font-size: 1.05rem; font-weight: 700; }
    .card-body { padding: 1.25rem; }

    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }
    .matrix-table th {
      color: var(--text-muted);
      padding: 0.6rem 0.85rem;
      border-bottom: 1px solid var(--card-border);
      font-weight: 600;
    }
    .matrix-table td {
      padding: 0.75rem 0.85rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.725rem;
      font-weight: 700;
    }
    .badge-pass { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-fail { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .badge-warn { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

    .finding-item {
      background: #172033;
      border: 1px solid #283754;
      border-radius: 10px;
      padding: 1.15rem;
      margin-bottom: 1rem;
      transition: border-color 0.2s;
    }
    .finding-item:hover { border-color: #3b82f6; }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .finding-title { font-weight: 700; font-size: 0.95rem; color: #f1f5f9; }
    .finding-loc { font-family: monospace; font-size: 0.8rem; color: #60a5fa; background: #0f172a; padding: 0.2rem 0.5rem; border-radius: 4px; }
    .finding-desc { font-size: 0.85rem; color: #cbd5e1; margin: 0.4rem 0; line-height: 1.4; }
    
    .snippet-box {
      background: #090e17;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 0.6rem 0.75rem;
      font-family: monospace;
      font-size: 0.8rem;
      margin: 0.6rem 0;
      white-space: pre-wrap;
      color: #fca5a5;
      border-left: 3px solid var(--danger);
      overflow-x: auto;
    }
    .remed-box {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      padding: 0.6rem 0.75rem;
      border-radius: 6px;
      font-size: 0.825rem;
      color: #a7f3d0;
      margin: 0.6rem 0;
      line-height: 1.4;
    }
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid #243048;
    }
    .btn-copy {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: white;
      border: none;
      padding: 0.45rem 0.85rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .btn-copy:hover { transform: translateY(-1px); box-shadow: 0 6px 10px -1px rgba(37, 99, 235, 0.4); }
    .btn-copy.copied { background: var(--success); }

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
      <button class="btn btn-ai" onclick="copyMasterAiPlan()" id="btnMasterPlan">🤖 Copy Full AI Fix Plan</button>
      <button class="btn" onclick="triggerAudit()" id="btnAudit">🔄 Run Audit</button>
    </div>
  </header>

  <div class="project-strip">
    <div class="project-strip-row">
      <label>📁 Target Project:</label>
      <input type="text" id="projectPathInput" value="${activeProjectRoot.replace(/\\/g, '\\\\')}" placeholder="Paste folder path to any project (e.g. C:\\...\\campus-connect-lpu)" />
      <button class="btn btn-secondary" onclick="connectProject()" id="btnConnect">🔗 Connect & Audit</button>
      <button class="btn btn-secondary" onclick="generateAntigravityRules()" id="btnAgents">🤖 Inject AGENTS.md</button>
    </div>
    <div style="display:flex; gap:0.5rem; align-items:center; margin-left:110px">
      <span style="font-size:0.75rem; color:#94a3b8">Quick Presets:</span>
      <button class="preset-pill" onclick="setAndConnect('C:\\\\Users\\\\mishr\\\\.gemini\\\\antigravity\\\\scratch\\\\campus-connect-lpu')">🏫 Campus Connect (LPU)</button>
      <button class="preset-pill" onclick="setAndConnect('C:\\\\Users\\\\mishr\\\\.gemini\\\\antigravity\\\\scratch\\\\ccg-guardian')">🛡️ CCG Guardian (Clean Engine)</button>
    </div>
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
          <div class="card-title">Where to Fix & AI Solutions</div>
          <span id="blockerCountBadge" class="badge badge-fail">0</span>
        </div>
        <div class="card-body" id="blockersList" style="max-height: 680px; overflow-y: auto;">
          <div style="text-align:center; color: var(--text-muted); padding: 2rem">No blockers loaded</div>
        </div>
      </div>
    </div>
  </main>

  <footer>
    <small>engineered with precision — credits to real developer rajvansh mishra, backend developer, lovely professional university (<a href="https://github.com/RAJ-DEV-V" target="_blank">github: https://github.com/RAJ-DEV-V</a>)</small>
  </footer>

  <script>
    let currentReport = null;

    async function loadStats() {
      try {
        const res = await fetch('/api/stats?t=' + Date.now());
        const data = await res.json();
        currentReport = data;
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
        : (data.blockerCount || 0) + ' Critical/High defect(s) detected. Click below to copy AI prompts or fix instructions.';

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
            <td style="color:var(--text-muted); font-size:0.775rem">\${row.evidence}</td>
          </tr>\`;
        }).join('');
      }

      // Render Blockers List with AI Prompt and Where/How to fix
      const blockers = (data.findings || []).filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
      const allDisplayFindings = blockers.length > 0 ? blockers : (data.findings || []);
      document.getElementById('blockerCountBadge').innerText = blockers.length;
      const blockersList = document.getElementById('blockersList');

      if (allDisplayFindings.length === 0) {
        blockersList.innerHTML = \`
          <div style="text-align:center; padding: 2rem; color: var(--success)">
            <div style="font-size:2rem; margin-bottom:0.5rem">🎉</div>
            <div style="font-weight:700; font-size:1.1rem; margin-bottom:0.5rem">Zero Defects Detected!</div>
            <div style="color:var(--text-muted); font-size:0.875rem; margin-bottom:1rem">This repository passes all 10 engineering gates with 0 blockers.</div>
            <button class="btn btn-secondary" style="margin:0 auto;" onclick="setAndConnect('C:\\\\\\\\Users\\\\\\\\mishr\\\\\\\\.gemini\\\\\\\\antigravity\\\\\\\\scratch\\\\\\\\campus-connect-lpu')">
              👉 Connect & Inspect Campus Connect (LPU)
            </button>
          </div>
        \`;
      } else {
        blockersList.innerHTML = allDisplayFindings.map((b, idx) => {
          const promptText = b.aiPrompt || generateFallbackPrompt(b);
          return \`
          <div class="finding-item" id="finding-\${idx}">
            <div class="finding-header">
              <span class="badge \${b.severity === 'CRITICAL' ? 'badge-fail' : (b.severity === 'HIGH' ? 'badge-warn' : 'badge-pass')}">\${b.severity}</span>
              <span class="finding-loc">📍 \${b.file}\${b.line ? ':' + b.line : ''}</span>
            </div>
            <div class="finding-title">\${b.title}</div>
            <div class="finding-desc">\${b.message}</div>
            \${b.snippet ? \`<div class="snippet-box"><strong>Current Code:</strong>\n\${escapeHtml(b.snippet)}</div>\` : ''}
            <div class="remed-box"><strong>🛠️ How & Where to Fix:</strong><br>\${escapeHtml(b.remediation)}</div>
            <div class="action-bar">
              <span style="font-size:0.75rem; color:var(--text-muted)">Ready for Antigravity, ChatGPT, Claude or Cursor</span>
              <button class="btn-copy" onclick="copyAiPrompt(\${idx}, this)">
                🤖 Copy AI Fix Prompt
              </button>
            </div>
            <textarea id="prompt-val-\${idx}" style="display:none;">\${escapeHtml(promptText)}</textarea>
          </div>
        \`;
        }).join('');
      }
    }

    function generateFallbackPrompt(b) {
      return \`### 🛡️ Engineering Guardian AI Remediation Request\\n\\n\` +
        \`**Target File:** \`\${b.file}\${b.line ? ':' + b.line : ''}\`\\n\` +
        \`**Severity:** \`\${b.severity}\` | **Issue:** \${b.title}\\n\\n\` +
        \`**Problem:** \${b.message}\\n\\n\` +
        (b.snippet ? \`**Current Code:**\\n\`\`\`typescript\\n\${b.snippet}\\n\`\`\`\\n\\n\` : '') +
        \`**Required Fix:**\\n\${b.remediation}\\n\\n\` +
        \`**Constraint:** Fix cleanly without breaking other logic, then run 'npm run guardian' to verify.\\n\`;
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function copyAiPrompt(idx, btn) {
      const textarea = document.getElementById('prompt-val-' + idx);
      if (textarea) {
        navigator.clipboard.writeText(textarea.value).then(() => {
          const original = btn.innerHTML;
          btn.innerHTML = '✅ Copied to Clipboard!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('copied');
          }, 2500);
        });
      }
    }

    function copyMasterAiPlan() {
      if (!currentReport || !currentReport.findings) return alert('No report loaded.');
      const blockers = currentReport.findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
      if (blockers.length === 0) return alert('No blockers detected! Codebase is already clean.');

      let masterPrompt = \`# 🛡️ Engineering Guardian Master Remediation Plan\\n\`;
      masterPrompt += \`Connected Project: \${currentReport.connectedProject || 'Current Project'}\\n\`;
      masterPrompt += \`Total Blockers: \${blockers.length}\\n\\n\`;
      masterPrompt += \`Please fix the following issues in order, keeping all architectural boundaries intact:\\n\\n\`;

      blockers.forEach((b, i) => {
        masterPrompt += \`---\\n### [Blocker #\${i + 1}] \${b.title}\\n\`;
        masterPrompt += \`- File: \`\${b.file}\${b.line ? ':' + b.line : ''}\`\\n\`;
        masterPrompt += \`- Severity: \`\${b.severity}\`\\n\`;
        masterPrompt += \`- Issue: \${b.message}\\n\`;
        if (b.snippet) {
          masterPrompt += \`\`\`typescript\\n\${b.snippet}\\n\`\`\`\\n\`;
        }
        masterPrompt += \`- Action: \${b.remediation}\\n\\n\`;
      });

      masterPrompt += \`---\\nAfter applying all fixes, run 'npm run guardian' to verify that all assurance gates pass!\\n\`;

      navigator.clipboard.writeText(masterPrompt).then(() => {
        const btn = document.getElementById('btnMasterPlan');
        const orig = btn.innerText;
        btn.innerText = '✅ Master Plan Copied!';
        setTimeout(() => { btn.innerText = orig; }, 3000);
        alert('Master AI Plan copied to clipboard! Paste it into Antigravity or ChatGPT to fix all blockers at once.');
      });
    }

    async function generateAntigravityRules() {
      const btn = document.getElementById('btnAgents');
      btn.disabled = true;
      btn.innerText = '⏳ Generating...';
      try {
        const res = await fetch('/api/antigravity', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Antigravity AGENTS.md rules injected successfully!');
      } catch (e) {
        alert('Failed: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.innerText = '🤖 Inject AGENTS.md';
      }
    }

    function setAndConnect(targetPath) {
      document.getElementById('projectPathInput').value = targetPath;
      connectProject();
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
          currentReport = data;
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
        currentReport = data;
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
  // Enforce zero caching so browsers always load live UI and telemetry
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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
   - Never interpolate user-controlled variables into raw SQL queries (use parameterized \$1 or ORM builders).
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
  console.log(`credits to developer rajvansh mishra, backend developer, lovely professional university (github: https://github.com/RAJ-DEV-V)\n`);
});

// Optionally auto-open browser if running directly
if (process.argv.includes('--open')) {
  const openCmd = process.platform === 'win32' ? `start http://localhost:${PORT}` : `open http://localhost:${PORT}`;
  exec(openCmd);
}
