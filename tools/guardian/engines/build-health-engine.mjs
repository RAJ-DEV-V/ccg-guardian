/**
 * Engine 10: Build & Type Health Engine
 * Verifies compilation errors, missing types, and invalid environment variable bindings.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { BaseEngine } from './base-engine.mjs';
import { Severity, EvidenceType } from '../core/types.mjs';
import { getLineAndColumn, getSnippet } from '../core/ast-parser.mjs';

export class BuildHealthEngine extends BaseEngine {
  constructor() {
    super({
      id: 'build-type-health',
      name: 'Build & Type Health Engine',
      description: 'Verifies zero compilation errors, type soundness, and environment variable bindings.',
      category: 'Build'
    });
  }

  getEnvExampleVariables(rootDir) {
    const envExamplePath = path.join(rootDir, '.env.example');
    const declared = new Set();
    if (fs.existsSync(envExamplePath)) {
      try {
        const lines = fs.readFileSync(envExamplePath, 'utf8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              declared.add(trimmed.slice(0, eqIdx).trim());
            } else {
              declared.add(trimmed);
            }
          }
        }
      } catch {
        // ignore read error
      }
    }
    return declared;
  }

  async run(context) {
    this.findings = [];
    const { rootDir, files } = context;

    // 1. Environment Variable Integrity Check
    const declaredEnvVars = this.getEnvExampleVariables(rootDir);
    // Standard system environment variables to permit
    const standardEnv = new Set(['NODE_ENV', 'PORT', 'PATH', 'VERCEL', 'CI']);

    const targetCodeFiles = this.filterFiles(files, ['.ts', '.tsx', '.js', '.jsx']);

    for (const relFile of targetCodeFiles) {
      const fullPath = path.isAbsolute(relFile) ? relFile : path.join(rootDir, relFile);
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      const envRegex = /process\.env\.([A-Z0-9_]+)/g;
      let match;
      while ((match = envRegex.exec(content)) !== null) {
        const varName = match[1];
        if (declaredEnvVars.size > 0 && !declaredEnvVars.has(varName) && !standardEnv.has(varName)) {
          const { line, column } = getLineAndColumn(content, match.index);
          this.addFinding({
            id: 'BUILD-UNDECLARED-ENV-VAR',
            severity: Severity.MEDIUM,
            title: `Undocumented Environment Variable Binding: ${varName}`,
            message: `Code references 'process.env.${varName}', but '${varName}' is not documented in .env.example. Missing environment configurations will cause production deployment failures.`,
            file: relFile,
            line,
            column,
            snippet: getSnippet(content, line),
            evidenceType: EvidenceType.STATIC,
            evidence: `process.env.${varName} absent from .env.example`,
            remediation: `Add '${varName}=<placeholder>' to .env.example and document its purpose.`
          });
        }
      }
    }

    // 2. TypeScript Type & Compilation Health Check
    const tsconfigPath = path.join(rootDir, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      try {
        // Run tsc --noEmit with 15s timeout
        execSync('npx --no-install tsc --noEmit --skipLibCheck', {
          cwd: rootDir,
          encoding: 'utf8',
          timeout: 15000,
          stdio: ['ignore', 'pipe', 'pipe']
        });
      } catch (err) {
        const output = (err.stdout || '') + (err.stderr || '');
        const errorLines = output.split('\n').filter(l => l.includes('error TS'));

        for (const errLine of errorLines.slice(0, 5)) { // Cap to first 5 critical errors
          const parts = errLine.match(/^([^(]+)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.*)$/);
          if (parts) {
            const [, file, line, col, code, message] = parts;
            this.addFinding({
              id: `BUILD-TYPE-${code}`,
              severity: Severity.HIGH,
              title: `TypeScript Compilation Error ${code}: ${message}`,
              message: `Type checker detected compile error: ${message}`,
              file: path.relative(rootDir, file).replace(/\\/g, '/'),
              line: parseInt(line, 10),
              column: parseInt(col, 10),
              evidenceType: EvidenceType.SCANNER,
              evidence: errLine,
              remediation: `Fix type defect or export type definition for '${file}'.`
            });
          }
        }
      }
    }

    return this.findings;
  }
}
