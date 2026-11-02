/**
 * Engineering Guardian Orchestrator
 * Coordinates file discovery, git diff analysis, execution of the 10 engines,
 * verdict determination, and dual report generation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Severity, Verdict } from './core/types.mjs';
import { getGitStatus, getGitDiffLines } from './core/git-inspector.mjs';
import { Reporter } from './core/reporter.mjs';

import { ArchitectureEngine } from './engines/architecture-engine.mjs';
import { SecurityEngine } from './engines/security-engine.mjs';
import { LogicEngine } from './engines/logic-engine.mjs';
import { PerformanceEngine } from './engines/performance-engine.mjs';
import { DatabaseEngine } from './engines/database-engine.mjs';
import { RegressionEngine } from './engines/regression-engine.mjs';
import { ConcurrencyEngine } from './engines/concurrency-engine.mjs';
import { ErrorResilienceEngine } from './engines/error-resilience-engine.mjs';
import { SupplyChainEngine } from './engines/supply-chain-engine.mjs';
import { BuildHealthEngine } from './engines/build-health-engine.mjs';

export class GuardianOrchestrator {
  constructor({ rootDir = process.cwd(), outputDir = 'reports/guardian' } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.outputDir = outputDir;
    this.reporter = new Reporter({ outputDir });

    this.engines = [
      new ArchitectureEngine(),
      new SecurityEngine(),
      new LogicEngine(),
      new PerformanceEngine(),
      new DatabaseEngine(),
      new RegressionEngine(),
      new ConcurrencyEngine(),
      new ErrorResilienceEngine(),
      new SupplyChainEngine(),
      new BuildHealthEngine()
    ];
  }

  getAllFiles(dir = this.rootDir, fileList = []) {
    const ignoreDirs = new Set(['node_modules', '.next', '.git', 'dist', 'out', 'fixtures', '.venv', 'backups', 'reports']);
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example' && entry.name !== '.env.local') {
        continue;
      }
      if (ignoreDirs.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.getAllFiles(fullPath, fileList);
      } else if (entry.isFile()) {
        fileList.push(path.relative(this.rootDir, fullPath).replace(/\\/g, '/'));
      }
    }

    return fileList;
  }

  async audit({ mode = 'diff', targetedEngine = null } = {}) {
    const startTime = Date.now();
    const gitStatus = getGitStatus(this.rootDir);
    const allFiles = this.getAllFiles();

    let targetFiles = allFiles;
    let changedFiles = (gitStatus.modified || []).filter(f => !f.replace(/\\/g, '/').startsWith('reports/'));

    if (mode === 'diff') {
      if (changedFiles.length > 0) {
        // In diff mode, audit changed files + core root configs
        targetFiles = Array.from(new Set([
          ...changedFiles,
          ...allFiles.filter(f => f.startsWith('lib/') || f.startsWith('app/api/'))
        ])).filter(f => !f.replace(/\\/g, '/').startsWith('reports/'));
      }
    }

    const context = {
      rootDir: this.rootDir,
      files: targetFiles,
      allFiles,
      changedFiles,
      gitStatus,
      mode
    };

    let activeEngines = this.engines;
    if (targetedEngine) {
      activeEngines = this.engines.filter(e => e.id === targetedEngine || e.category.toLowerCase() === targetedEngine.toLowerCase());
    }

    const allFindings = [];

    for (const engine of activeEngines) {
      try {
        const findings = await engine.run(context);
        allFindings.push(...findings);
      } catch (err) {
        console.error(`[Guardian] Engine ${engine.name} encountered an execution error:`, err);
      }
    }

    // Determine verdict: ANY critical or high finding blocks the gate
    const hasBlockers = allFindings.some(f => f.severity === Severity.CRITICAL || f.severity === Severity.HIGH);
    const verdict = hasBlockers ? Verdict.BLOCKED : Verdict.APPROVED;
    const durationMs = Date.now() - startTime;

    const reportData = {
      verdict,
      mode,
      durationMs,
      filesScannedCount: targetFiles.length,
      gitStatus: {
        modifiedCount: changedFiles.length,
        modifiedFiles: changedFiles
      },
      findingsCount: allFindings.length,
      blockerCount: allFindings.filter(f => f.severity === Severity.CRITICAL || f.severity === Severity.HIGH).length,
      warningCount: allFindings.filter(f => f.severity === Severity.MEDIUM).length,
      infoCount: allFindings.filter(f => f.severity === Severity.LOW || f.severity === Severity.INFO).length,
      findings: allFindings,
      assuranceMatrix: this.reporter.computeAssuranceMatrix(allFindings)
    };

    const reportPaths = this.reporter.saveReports(reportData, this.rootDir);

    return {
      verdict,
      findings: allFindings,
      reportData,
      reportPaths,
      durationMs,
      filesScannedCount: targetFiles.length
    };
  }
}
