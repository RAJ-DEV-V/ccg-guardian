/**
 * Engineering Guardian (CCG / CCEG) Core Types & Constants
 * Zero-dependency codebase quality, security & architecture assurance engine
 */

export const Severity = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO'
};

export const Verdict = {
  APPROVED: 'APPROVED',
  APPROVED_WITH_RISKS: 'APPROVED_WITH_RISKS',
  BLOCKED: 'BLOCKED',
  INCONCLUSIVE: 'INCONCLUSIVE'
};

export const EvidenceType = {
  STATIC: 'STATIC',
  AST_ANALYSIS: 'AST_ANALYSIS',
  SCANNER: 'SCANNER',
  GIT_DIFF: 'GIT_DIFF',
  RUNTIME_OBSERVATION: 'RUNTIME_OBSERVATION',
  MEASUREMENT: 'MEASUREMENT',
  NOT_TESTED: 'NOT_TESTED'
};

export const AssuranceMatrixRows = [
  'Requirements Fidelity',
  'Functional Correctness',
  'Logic & Execution Flow',
  'Security & Vulnerabilities',
  'Authorization & Access Control',
  'Data Integrity & Migrations',
  'Concurrency & Race Conditions',
  'Error Handling & Resilience',
  'Performance & Resource Gates',
  'Cost & Abuse (Denial of Wallet)',
  'Regression & Blast Radius',
  'UX, Feedback & Accessibility',
  'Build & Type Health',
  'Dependencies & Supply Chain',
  'Test Quality & Verification',
  'Observability & Maintainability'
];

export const ProtectedFiles = [
  'package.json',
  'package-lock.json',
  'next.config.mjs',
  'next.config.js',
  'tsconfig.json',
  'Dockerfile',
  'docker-compose.yml',
  '.env.example',
  'scripts/seed.mjs',
  'supabase/seed.sql',
  '.github/workflows/deploy.yml',
  '.github/workflows/ci.yml'
];

/**
 * Generates a prompt-engineered instruction ready to paste into Antigravity, ChatGPT, Claude, or Cursor
 */
export function generateAiPrompt(finding) {
  const lineInfo = finding.line ? `:${finding.line}` : '';
  let prompt = `### 🛡️ Engineering Guardian AI Remediation Request\n\n`;
  prompt += `**Target File:** \`${finding.file}${lineInfo}\`\n`;
  prompt += `**Severity:** \`${finding.severity}\` | **Defect ID:** \`${finding.id}\`\n`;
  prompt += `**Defect Title:** ${finding.title}\n\n`;
  prompt += `#### 📋 Problem Explanation:\n${finding.message}\n\n`;

  if (finding.snippet) {
    prompt += `#### 🔍 Current Problematic Code Snippet:\n\`\`\`typescript\n${finding.snippet}\n\`\`\`\n\n`;
  }

  prompt += `#### 🛠️ Exact Step-by-Step Remediation:\n${finding.remediation}\n\n`;

  prompt += `#### ⚠️ Engineering Constraints:\n`;
  prompt += `1. Apply the smallest, cleanest patch that directly solves the issue in \`${finding.file}\`.\n`;
  prompt += `2. Maintain all existing caller interfaces and architectural separation.\n`;
  prompt += `3. Do not suppress errors, comment out checks, or bypass validation.\n`;
  prompt += `4. Confirm the fix by running \`npm run guardian\` or the Guardian Dashboard to prove the gate passes.\n`;

  return prompt;
}

/**
 * Creates a normalized finding object
 */
export function createFinding({
  id,
  engine,
  category = 'General',
  severity = Severity.MEDIUM,
  title,
  message,
  file,
  line = null,
  column = null,
  snippet = null,
  evidenceType = EvidenceType.STATIC,
  evidence = '',
  remediation = '',
  requiresHumanAction = false
}) {
  const findingObj = {
    id,
    engine,
    category,
    severity,
    title,
    message,
    file,
    line,
    column,
    snippet,
    evidenceType,
    evidence,
    remediation,
    requiresHumanAction,
    timestamp: new Date().toISOString()
  };

  findingObj.aiPrompt = generateAiPrompt(findingObj);
  return findingObj;
}
