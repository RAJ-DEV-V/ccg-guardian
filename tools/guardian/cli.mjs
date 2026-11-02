#!/usr/bin/env node
/**
 * Engineering Guardian (CCG / CCEG) CLI
 * Standalone, zero-dependency codebase quality, security & architecture assurance runner.
 * 
 * credits to developer rajvansh mishra, backend developer, lovely professional university
 * github: https://github.com/RAJ-DEV-V
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { GuardianOrchestrator } from './orchestrator.mjs';
import { Severity, Verdict } from './core/types.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let projectRoot = path.resolve(__dirname, '../..');

// Parse CLI flags
const args = process.argv.slice(2);
const isFull = args.includes('--full');
const isSecurityOnly = args.includes('--security');
const isArchOnly = args.includes('--architecture');
const isDbOnly = args.includes('--database');
const isJsonOutput = args.includes('--json');
const isTestMode = args.includes('--test') || args.includes('test');

// Check for target project path flag or positional arg
const projectArgIdx = args.findIndex(a => a === '--project' || a === '-p');
if (projectArgIdx !== -1 && args[projectArgIdx + 1]) {
  projectRoot = path.resolve(args[projectArgIdx + 1]);
} else {
  const positionalPath = args.find(a => !a.startsWith('-') && a !== 'test');
  if (positionalPath && fs.existsSync(positionalPath)) {
    projectRoot = path.resolve(positionalPath);
  }
}

if (isTestMode) {
  const testScript = path.join(__dirname, 'tests/synthetic-fixtures.test.mjs');
  const result = spawnSync('node', [testScript], { stdio: 'inherit' });
  process.exit(result.status || 0);
}

let mode = 'diff';
let targetedEngine = null;

if (isFull) {
  mode = 'full';
} else if (isSecurityOnly) {
  mode = 'targeted';
  targetedEngine = 'security-vulnerability';
} else if (isArchOnly) {
  mode = 'targeted';
  targetedEngine = 'architecture-boundaries';
} else if (isDbOnly) {
  mode = 'targeted';
  targetedEngine = 'database-data-loss';
}

async function main() {
  if (!isJsonOutput) {
    console.log('\n================================================================');
    console.log('   🛡️  ENGINEERING GUARDIAN (CCG / CCEG) - MULTI-ENGINE ASSURANCE');
    console.log('================================================================');
    console.log(` Mode:           [${mode.toUpperCase()}]`);
    console.log(` Target Root:    ${projectRoot}`);
    console.log(` Engine Filter:  ${targetedEngine || 'ALL 10 ENGINES'}`);
    console.log('----------------------------------------------------------------\n');
  }

  const orchestrator = new GuardianOrchestrator({
    rootDir: projectRoot,
    outputDir: path.join(projectRoot, 'reports/guardian')
  });

  try {
    const result = await orchestrator.audit({ mode, targetedEngine });

    if (isJsonOutput) {
      console.log(JSON.stringify(result.reportData, null, 2));
      process.exit(result.verdict === Verdict.APPROVED ? 0 : 1);
    }

    const { findings, verdict, reportPaths, durationMs, filesScannedCount } = result;

    const criticals = findings.filter(f => f.severity === Severity.CRITICAL);
    const highs = findings.filter(f => f.severity === Severity.HIGH);
    const mediums = findings.filter(f => f.severity === Severity.MEDIUM);
    const lows = findings.filter(f => f.severity === Severity.LOW || f.severity === Severity.INFO);
    const blockers = [...criticals, ...highs];

    console.log(`Inspected ${filesScannedCount} file(s) in ${durationMs}ms.\n`);

    if (blockers.length > 0) {
      console.log('❌ CRITICAL & HIGH DEFECTS DETECTED:');
      console.log('----------------------------------------------------------------');
      blockers.forEach((b, idx) => {
        console.log(`\n[BLOCKER #${idx + 1}] [${b.severity}] ${b.title}`);
        console.log(`  File:        ${b.file}${b.line ? `:${b.line}` : ''}`);
        console.log(`  Engine:      ${b.engine}`);
        console.log(`  Issue:       ${b.message}`);
        if (b.snippet) {
          console.log(`  Snippet:\n${b.snippet}`);
        }
        console.log(`  Remediation: ${b.remediation.replace(/\n/g, '\n               ')}`);
      });
      console.log('\n----------------------------------------------------------------');
    }

    if (mediums.length > 0 && blockers.length === 0) {
      console.log(`⚠️  ${mediums.length} Medium-risk warning(s) identified (non-blocking).`);
    }

    console.log('\nAudit Summary:');
    console.log(`  • Critical Blockers: ${criticals.length}`);
    console.log(`  • High Defects:      ${highs.length}`);
    console.log(`  • Medium Warnings:   ${mediums.length}`);
    console.log(`  • Low / Info:        ${lows.length}`);
    console.log(`  • Total Findings:    ${findings.length}`);
    console.log(`\nReports generated:`);
    console.log(`  📄 Markdown: ${path.relative(projectRoot, reportPaths.mdPath)}`);
    console.log(`  📊 JSON:     ${path.relative(projectRoot, reportPaths.jsonPath)}`);
    console.log('\n----------------------------------------------------------------');

    if (verdict === Verdict.APPROVED) {
      console.log('>>> VERDICT: [APPROVED] <<<');
      console.log('Codebase passes all assurance gates. Safe to commit and deploy.\n');
      console.log('<small>credits to developer rajvansh mishra, backend developer, lovely professional university (https://github.com/RAJ-DEV-V)</small>\n');
      process.exit(0);
    } else {
      console.log('>>> VERDICT: [BLOCKED] <<<');
      console.log(`Commit or build blocked due to ${blockers.length} critical/high defect(s).\n`);
      console.log('<small>credits to developer rajvansh mishra, backend developer, lovely professional university (https://github.com/RAJ-DEV-V)</small>\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal Guardian Execution Failure:', error);
    process.exit(1);
  }
}

main();
