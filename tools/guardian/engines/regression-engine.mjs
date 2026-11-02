/**
 * Engine 6: Regression & Blast-Radius Engine
 * Constructs dependency graphs across imports and calculates the downstream blast radius
 * of any modified or core utility file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { BaseEngine } from './base-engine.mjs';
import { Severity, EvidenceType } from '../core/types.mjs';
import { extractImports } from '../core/ast-parser.mjs';

export class RegressionEngine extends BaseEngine {
  constructor() {
    super({
      id: 'regression-blast-radius',
      name: 'Regression & Blast-Radius Engine',
      description: 'Maps module dependencies and calculates blast radius for changed files.',
      category: 'Regression'
    });
  }

  resolveImport(importSpecifier, fromFile, rootDir, allFiles) {
    // Handle path alias '@/...'
    let candidatePath;
    if (importSpecifier.startsWith('@/')) {
      candidatePath = importSpecifier.slice(2);
    } else if (importSpecifier.startsWith('.')) {
      const dir = path.dirname(fromFile);
      candidatePath = path.join(dir, importSpecifier).replace(/\\/g, '/');
    } else {
      return null; // External package
    }

    // Try extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
    for (const ext of extensions) {
      const testPath = (candidatePath + ext).replace(/\\/g, '/');
      if (allFiles.includes(testPath)) {
        return testPath;
      }
    }
    return null;
  }

  buildDependencyGraph(rootDir, files) {
    const targetFiles = this.filterFiles(files, ['.ts', '.tsx', '.js', '.jsx']);
    const directDependents = new Map(); // module -> Set of files that import it

    for (const relFile of targetFiles) {
      directDependents.set(relFile, new Set());
    }

    for (const relFile of targetFiles) {
      const fullPath = path.isAbsolute(relFile) ? relFile : path.join(rootDir, relFile);
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      const imports = extractImports(content);
      for (const imp of imports) {
        const resolved = this.resolveImport(imp.specifier, relFile, rootDir, targetFiles);
        if (resolved && directDependents.has(resolved)) {
          directDependents.get(resolved).add(relFile);
        }
      }
    }

    return directDependents;
  }

  calculateBlastRadius(targetFile, directDependents) {
    const visited = new Set();
    const queue = [targetFile];

    while (queue.length > 0) {
      const current = queue.shift();
      const dependents = directDependents.get(current);
      if (dependents) {
        for (const dep of dependents) {
          if (!visited.has(dep)) {
            visited.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    return Array.from(visited);
  }

  async run(context) {
    this.findings = [];
    const { rootDir, files, changedFiles = [] } = context;
    const targetFiles = this.filterFiles(files, ['.ts', '.tsx', '.js', '.jsx']);

    const depGraph = this.buildDependencyGraph(rootDir, targetFiles);

    // If changedFiles provided, check blast radius of each changed file
    // Otherwise scan high-risk files (e.g. lib/utils.ts, lib/auth.ts, middleware.ts)
    const filesToAudit = changedFiles.length > 0 ? changedFiles : targetFiles.filter(f => f.startsWith('lib/') || f.startsWith('utils/') || f.includes('middleware'));

    for (const file of filesToAudit) {
      const normalized = file.replace(/\\/g, '/');
      if (!depGraph.has(normalized)) continue;

      const blastRadius = this.calculateBlastRadius(normalized, depGraph);
      const isCritical = blastRadius.length >= 10;
      const isHigh = blastRadius.length >= 5;

      if (isHigh) {
        this.addFinding({
          id: 'REGR-HIGH-BLAST-RADIUS',
          severity: isCritical ? Severity.HIGH : Severity.MEDIUM,
          title: `High Blast Radius on Modified Module: ${normalized} (${blastRadius.length} dependents)`,
          message: `Modifications to '${normalized}' directly or transitively impact ${blastRadius.length} downstream components and route handlers. High blast-radius changes have high risk of introducing silent regressions.`,
          file: normalized,
          evidenceType: EvidenceType.STATIC,
          evidence: `Direct and transitive consumers:\n- ${blastRadius.slice(0, 8).join('\n- ')}${blastRadius.length > 8 ? `\n... and ${blastRadius.length - 8} more` : ''}`,
          remediation: `Ensure comprehensive regression tests are run for downstream modules before releasing:\n${blastRadius.slice(0, 5).join(', ')}`
        });
      }
    }

    return this.findings;
  }
}
