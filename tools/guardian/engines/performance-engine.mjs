/**
 * Engine 4: Performance & Denial-of-Wallet (Resource Gate) Engine
 * Detects N+1 query loops, runaway polling timers, unbounded queries, and serverless compute hazards.
 */

import fs from 'node:fs';
import path from 'node:path';
import { BaseEngine } from './base-engine.mjs';
import { Severity, EvidenceType } from '../core/types.mjs';
import { findLoops, getLineAndColumn, getSnippet } from '../core/ast-parser.mjs';

export class PerformanceEngine extends BaseEngine {
  constructor() {
    super({
      id: 'performance-resource-gate',
      name: 'Performance & Denial-of-Wallet Engine',
      description: 'Prevents N+1 queries, runaway polling, unbounded SELECT queries, and runaway billing costs.',
      category: 'Performance'
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

      // 1. Detect N+1 Query Loops (Database calls or fetch calls inside loop bodies)
      const loops = findLoops(content);
      for (const loop of loops) {
        // Query patterns inside loop body
        const nPlusOnePatterns = [
          { pattern: /(?:supabase\s*\.\s*from\s*\([^)]*\)\s*\.(?:select|insert|update|delete)|db\s*\.\s*query\s*\(|prisma\s*\.\s*\w+\s*\.(?:find|create|update)|fetch\s*\()/g, name: 'Database Query / Fetch' }
        ];

        for (const p of nPlusOnePatterns) {
          let match;
          while ((match = p.pattern.exec(loop.body)) !== null) {
            const approximateLine = loop.startLine + loop.body.slice(0, match.index).split('\n').length - 1;
            this.addFinding({
              id: 'PERF-N-PLUS-ONE-LOOP',
              severity: Severity.HIGH,
              title: `N+1 Query Pattern Inside Iteration Loop`,
              message: `Asynchronous ${p.name} executed iteratively inside a loop construct. This scales query counts with collection size (O(N)), leading to high latency and database connection pool exhaustion.`,
              file: relFile,
              line: approximateLine,
              snippet: getSnippet(content, approximateLine),
              evidenceType: EvidenceType.AST_ANALYSIS,
              evidence: `Iterative execution pattern: "${match[0]}" inside ${loop.header.trim()}`,
              remediation: 'Batch queries using WHERE IN / .in() operators, or execute batch operations before the loop using Promise.all().'
            });
          }
        }
      }

      // 2. Detect Aggressive or Runaway Polling Timers (setInterval < 1000ms)
      const timerRegex = /setInterval\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{?[^,]*,\s*(\d+)\s*\)/g;
      let timerMatch;
      while ((timerMatch = timerRegex.exec(content)) !== null) {
        const intervalMs = parseInt(timerMatch[1], 10);
        if (intervalMs < 1000) {
          const { line, column } = getLineAndColumn(content, timerMatch.index);
          this.addFinding({
            id: 'PERF-RUNAWAY-INTERVAL',
            severity: Severity.HIGH,
            title: `Aggressive Polling Interval (< 1000ms): ${intervalMs}ms`,
            message: `setInterval timer configured with extremely short cycle of ${intervalMs}ms. Rapid polling risks denial-of-wallet, CPU spikes, and client-side UI freezing.`,
            file: relFile,
            line,
            column,
            snippet: getSnippet(content, line),
            evidenceType: EvidenceType.AST_ANALYSIS,
            evidence: `setInterval with interval ${intervalMs}ms`,
            remediation: 'Use WebSockets or Server-Sent Events (SSE) for sub-second updates, or increase polling interval to >= 3000ms with exponential backoff.'
          });
        }
      }

      // 3. Detect Unbounded Queries (missing pagination / limit on SELECT *)
      const unboundedRegex = /supabase\s*\.\s*from\s*\(['"][^'"]+['"]\)\s*\.\s*select\s*\(\s*['"]\*['"]\s*\)([\s\S]*?)(?:;|\n\s*(?:const|let|var|return|if|\}|\)))/g;
      let unboundedMatch;
      while ((unboundedMatch = unboundedRegex.exec(content)) !== null) {
        const chain = unboundedMatch[1] || '';
        const hasBound = /\.(?:limit|range|single|maybeSingle)\s*\(/.test(chain);
        if (!hasBound) {
          const { line, column } = getLineAndColumn(content, unboundedMatch.index);
          this.addFinding({
            id: 'PERF-UNBOUNDED-SELECT',
            severity: Severity.MEDIUM,
            title: 'Unbounded SELECT * Query Without LIMIT/Range',
            message: 'Query retrieves all records with SELECT * without specifying `.limit(...)` or `.range(...)`. As tables grow, this leads to high memory spikes, slow queries, and bandwidth charges.',
            file: relFile,
            line,
            column,
            snippet: getSnippet(content, line),
            evidenceType: EvidenceType.AST_ANALYSIS,
            evidence: unboundedMatch[0].trim(),
            remediation: 'Append `.limit(50)` or `.range(0, 49)` to implement deterministic pagination.'
          });
        }
      }

      // 4. Heavy Serverless Compute Patterns (sync file reading in serverless API routes)
      if (relFile.includes('/api/') || relFile.includes('\\api\\')) {
        if (/fs\s*\.\s*readFileSync|fs\s*\.\s*writeFileSync/.test(content)) {
          this.addFinding({
            id: 'PERF-SERVERLESS-SYNC-IO',
            severity: Severity.HIGH,
            title: 'Synchronous File I/O in Serverless Route Handler',
            message: 'Serverless function uses synchronous file operations (readFileSync/writeFileSync). This blocks the Node.js event loop during concurrent requests and triggers function timeouts.',
            file: relFile,
            evidenceType: EvidenceType.AST_ANALYSIS,
            evidence: 'fs.readFileSync or fs.writeFileSync detected in API route',
            remediation: 'Use streaming (fs.createReadStream) or asynchronous methods (fs.promises.readFile).'
          });
        }
      }
    }

    return this.findings;
  }
}
