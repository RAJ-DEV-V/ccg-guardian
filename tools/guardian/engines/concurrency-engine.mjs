/**
 * Engine 7: Concurrency & Race-Condition Engine
 * Detects check-then-act race conditions, duplicate submissions, and non-atomic mutations.
 */

import fs from 'node:fs';
import path from 'node:path';
import { BaseEngine } from './base-engine.mjs';
import { Severity, EvidenceType } from '../core/types.mjs';
import { getLineAndColumn, getSnippet } from '../core/ast-parser.mjs';

export class ConcurrencyEngine extends BaseEngine {
  constructor() {
    super({
      id: 'concurrency-race-condition',
      name: 'Concurrency & Race-Condition Engine',
      description: 'Flags parallel mutation routes lacking mutual exclusion, duplicate submissions, and TOCTOU races.',
      category: 'Concurrency'
    });
  }

  async run(context) {
    this.findings = [];
    const { rootDir, files } = context;
    const targetFiles = this.filterFiles(files, ['.ts', '.tsx', '.js', '.jsx']);

    for (const relFile of targetFiles) {
      const fullPath = path.isAbsolute(relFile) ? relFile : path.join(rootDir, relFile);
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      const isMutationRoute = relFile.includes('/api/') ||
                              relFile.includes('\\api\\') ||
                              /export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)/.test(content);

      // 1. Time-of-Check to Time-of-Use (TOCTOU) file race conditions
      // fs.existsSync followed shortly by fs.writeFileSync without atomic rename or lock
      const toctouRegex = /fs\s*\.\s*(?:existsSync|access)\s*\([^)]*\)[\s\S]{1,200}?fs\s*\.\s*(?:writeFileSync|writeFile)\s*\(/g;
      let toctouMatch;
      while ((toctouMatch = toctouRegex.exec(content)) !== null) {
        const { line } = getLineAndColumn(content, toctouMatch.index);
        this.addFinding({
          id: 'CONC-TOCTOU-FILE-RACE',
          severity: Severity.MEDIUM,
          title: 'Time-of-Check to Time-of-Use (TOCTOU) File Race Condition',
          message: 'Code checks file existence before writing in separate operations. Concurrent worker processes can interleave, corrupting data or causing race failures.',
          file: relFile,
          line,
          snippet: getSnippet(content, line),
          evidenceType: EvidenceType.AST_ANALYSIS,
          evidence: toctouMatch[0],
          remediation: 'Perform atomic write operations using unique temporary files and atomic `fs.rename()`, or use an exclusive file lock.'
        });
      }

      // 2. Read-Modify-Write Race Condition in Mutation Routes
      // Pattern: access mutable state (balance, credits, slots, etc.), calculate delta, and update without transaction/atomic operation
      if (isMutationRoute) {
        const hasStateAccess = /\b(?:balance|credits|quantity|slots|inventory|seats|stock)\b/i.test(content);
        const hasNonAtomicUpdate = /(?:balance\s*-\s*\w+|credits\s*-\s*\w+|inventory\s*-\s*\w+|quantity\s*-\s*\w+|\bcount\s*\+\s*1)/i.test(content);
        const hasAtomicGuard = /(?:increment\b|decrement\b|\batomic\b|BEGIN\b|transaction\b|\.rpc\s*\(['"]decrement)/i.test(content);

        if (hasStateAccess && hasNonAtomicUpdate && !hasAtomicGuard) {
          this.addFinding({
            id: 'CONC-READ-MODIFY-WRITE-RACE',
            severity: Severity.HIGH,
            title: 'Read-Modify-Write Race Condition on Mutable State',
            message: 'Endpoint reads state (balance/credits/slots) and updates it via client-calculated delta without database transaction lock or atomic increment/decrement RPC.',
            file: relFile,
            evidenceType: EvidenceType.AST_ANALYSIS,
            evidence: 'Read followed by arithmetic update without atomic database primitive',
            remediation: 'Use atomic SQL operations (`UPDATE table SET balance = balance - 1 WHERE id = ... AND balance >= 1`), or an explicit database transaction with row-level locks (FOR UPDATE).'
          });
        }

        // 3. Duplicate Submissions / Missing Idempotency on Payment or Checkout Routes
        const isFinancialRoute = /checkout|payment|order|purchase|charge|stripe/i.test(relFile);
        if (isFinancialRoute) {
          const hasIdempotency = /(?:idempotency|idempotent|x-idempotency-key)/i.test(content);
          if (!hasIdempotency) {
            this.addFinding({
              id: 'CONC-MISSING-IDEMPOTENCY',
              severity: Severity.HIGH,
              title: 'Missing Idempotency Protection on Financial Mutation Route',
              message: `Payment or order creation route '${relFile}' does not inspect or enforce an Idempotency-Key. Double clicks or network retries will lead to duplicate charges or double orders.`,
              file: relFile,
              evidenceType: EvidenceType.STATIC,
              evidence: 'Financial mutation route without Idempotency-Key header inspection',
              remediation: 'Require an `Idempotency-Key` header and store processed keys in Redis or database table with TTL before executing charge operations.'
            });
          }
        }
      }
    }

    return this.findings;
  }
}
