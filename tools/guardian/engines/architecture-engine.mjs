/**
 * Engine 1: Architecture & Boundaries Engine
 * Enforces clean separation between presentation, business logic, and database layers.
 * Detects leaked server secrets in client components and checks protected file boundaries.
 */

import fs from 'node:fs';
import path from 'node:path';
import { BaseEngine } from './base-engine.mjs';
import { Severity, EvidenceType } from '../core/types.mjs';
import { extractImports, getLineAndColumn, getSnippet } from '../core/ast-parser.mjs';
import { checkProtectedBoundaryViolations } from '../core/git-inspector.mjs';

export class ArchitectureEngine extends BaseEngine {
  constructor() {
    super({
      id: 'architecture-boundaries',
      name: 'Architecture & Boundaries Engine',
      description: 'Enforces clean layering, prevents secret exposure in client code, and guards protected boundaries.',
      category: 'Architecture'
    });
  }

  async run(context) {
    this.findings = [];
    const { rootDir, files, changedFiles = [] } = context;

    // 1. Check Protected Boundaries
    const protectedViolations = checkProtectedBoundaryViolations(changedFiles);
    for (const pv of protectedViolations) {
      this.addFinding({
        id: 'ARCH-PROTECTED-FILE-MODIFIED',
        severity: Severity.HIGH,
        title: `Protected Boundary Modified: ${pv.protectedTarget}`,
        message: `Protected configuration or deployment file was modified in current branch: ${pv.file}. Critical infrastructure files require explicit review.`,
        file: pv.file,
        evidenceType: EvidenceType.GIT_DIFF,
        evidence: `Modified file matches protected target ${pv.protectedTarget}`,
        remediation: `Verify that changes to ${pv.protectedTarget} are intentional and authorized. Revert if accidental.`
      });
    }

    // 2. Scan code files for architectural & boundary violations
    const targetFiles = this.filterFiles(files, ['.ts', '.tsx', '.js', '.jsx']);

    for (const relFile of targetFiles) {
      const fullPath = path.isAbsolute(relFile) ? relFile : path.join(rootDir, relFile);
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      const isClientFile = content.includes("'use client'") ||
                           content.includes('"use client"') ||
                           relFile.includes('/components/') ||
                           relFile.includes('\\components\\') ||
                           relFile.includes('/ui/') ||
                           relFile.includes('\\ui\\');

      // A. Check for leaked server secrets in client components
      if (isClientFile) {
        const forbiddenServerSecrets = [
          { pattern: /SUPABASE_SERVICE_ROLE_KEY/g, name: 'SUPABASE_SERVICE_ROLE_KEY' },
          { pattern: /AWS_SECRET_ACCESS_KEY/g, name: 'AWS_SECRET_ACCESS_KEY' },
          { pattern: /DATABASE_URL/g, name: 'DATABASE_URL' },
          { pattern: /STRIPE_SECRET_KEY/g, name: 'STRIPE_SECRET_KEY' },
          { pattern: /PRIVATE_KEY/g, name: 'PRIVATE_KEY' },
          { pattern: /JWT_SECRET/g, name: 'JWT_SECRET' }
        ];

        for (const secret of forbiddenServerSecrets) {
          let match;
          while ((match = secret.pattern.exec(content)) !== null) {
            const { line, column } = getLineAndColumn(content, match.index);
            this.addFinding({
              id: 'ARCH-SECRET-LEAK-CLIENT',
              severity: Severity.CRITICAL,
              title: `Server Secret Referenced in Client Component: ${secret.name}`,
              message: `The client component references server-only secret '${secret.name}'. In Next.js/React, client components are bundled into browser assets, exposing this secret to any visitor.`,
              file: relFile,
              line,
              column,
              snippet: getSnippet(content, line),
              evidenceType: EvidenceType.STATIC,
              evidence: `Client file contains reference to ${secret.name}`,
              remediation: `Never reference ${secret.name} in client components. Route the operation through an authenticated Server Action or API route (/app/api/*). Rotate the secret immediately if already committed!`,
              requiresHumanAction: true
            });
          }
        }

        // B. Check for forbidden server modules imported into client files
        const imports = extractImports(content);
        const forbiddenClientImports = ['node:fs', 'fs', 'node:child_process', 'child_process', 'pg', 'mysql2', 'sqlite3'];

        for (const imp of imports) {
          if (forbiddenClientImports.includes(imp.specifier)) {
            this.addFinding({
              id: 'ARCH-FORBIDDEN-CLIENT-IMPORT',
              severity: Severity.CRITICAL,
              title: `Forbidden Server-Only Module in Client Component: ${imp.specifier}`,
              message: `Client component directly imports Node server module '${imp.specifier}'. This breaks build bundling and violates presentation layer boundaries.`,
              file: relFile,
              line: imp.line,
              column: imp.column,
              snippet: getSnippet(content, imp.line),
              evidenceType: EvidenceType.AST_ANALYSIS,
              evidence: `Import statement imports ${imp.specifier}`,
              remediation: `Move logic utilizing '${imp.specifier}' to a server-side route handler or server action.`
            });
          }
        }
      }

      // C. Check direct database access in UI Presentation components
      const isPureUi = (relFile.includes('/components/ui/') || relFile.includes('\\components\\ui\\'));
      if (isPureUi) {
        if (/createClient\s*\(|\.from\s*\(['"][^'"]+['"]\)\s*\.(select|insert|update|delete)/.test(content)) {
          this.addFinding({
            id: 'ARCH-UI-DIRECT-DB',
            severity: Severity.HIGH,
            title: `Direct Database Access in Presentation UI: ${relFile}`,
            message: `Reusable UI component directly queries database tables. Presentation components should only receive data via props.`,
            file: relFile,
            evidenceType: EvidenceType.AST_ANALYSIS,
            evidence: 'Database query located inside components/ui/',
            remediation: 'Decouple database logic. Fetch data in page or container server components and pass down via props.'
          });
        }
      }
    }

    return this.findings;
  }
}
