/**
 * Engine 3: Logic & Execution-Path Tracer Engine
 * Detects floating async promises, empty or swallowed catch blocks, dead execution branches,
 * and unhandled promise rejections.
 */

import fs from 'node:fs';
import path from 'node:path';
import { BaseEngine } from './base-engine.mjs';
import { Severity, EvidenceType } from '../core/types.mjs';
import {
  findCatchBlocks,
  findUnreachableCode,
  stripComments,
  getLineAndColumn,
  getSnippet
} from '../core/ast-parser.mjs';

export class LogicEngine extends BaseEngine {
  constructor() {
    super({
      id: 'logic-execution-tracer',
      name: 'Logic & Execution-Path Tracer Engine',
      description: 'Traces execution paths for floating promises, swallowed errors, and dead code branches.',
      category: 'Logic'
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

      // 1. Detect Swallowed / Empty Catch Blocks
      const catchBlocks = findCatchBlocks(content);
      for (const cb of catchBlocks) {
        if (cb.isSwallowed) {
          this.addFinding({
            id: 'LOGIC-SWALLOWED-CATCH',
            severity: cb.isEmpty ? Severity.HIGH : Severity.MEDIUM,
            title: cb.isEmpty ? 'Empty Catch Block Hiding Critical Failures' : 'Swallowed Exception Without Logging or Fallback',
            message: `Catch block at line ${cb.line} swallows exceptions silently without logging to console/telemetry or returning fallback state. This turns fatal failures into silent bugs.`,
            file: relFile,
            line: cb.line,
            column: cb.column,
            snippet: getSnippet(content, cb.line),
            evidenceType: EvidenceType.AST_ANALYSIS,
            evidence: cb.isEmpty ? 'catch block has empty body' : `catch body lacks logging or rethrow: "${cb.body}"`,
            remediation: 'Log caught error with console.error(err), report to an observability client, or provide explicit fallback user feedback.'
          });
        }
      }

      // 2. Detect Dead Code Following Unconditional Returns / Throws
      const deadBranches = findUnreachableCode(content);
      for (const dc of deadBranches) {
        this.addFinding({
          id: 'LOGIC-DEAD-CODE',
          severity: Severity.LOW,
          title: `Dead / Unreachable Code After Jump Statement`,
          message: `Unreachable statement detected at line ${dc.line} following unconditional terminator at line ${dc.terminatorLine}: "${dc.code}".`,
          file: relFile,
          line: dc.line,
          snippet: getSnippet(content, dc.line),
          evidenceType: EvidenceType.AST_ANALYSIS,
          evidence: `Statement unreachable after terminator at line ${dc.terminatorLine}`,
          remediation: 'Remove the unreachable dead code or refactor control flow branches.'
        });
      }

      // 3. Detect Floating Asynchronous Promises (unawaited fetch or async operations)
      const clean = stripComments(content);
      const lines = clean.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Pattern: standalone call to fetch(...) or known async without await / return / const / let / void
        // Ignore lines ending with commas (e.g. inside Promise.all([ ... , ... ]))
        if (line.endsWith(',')) continue;

        const isFloatingAsync = /^(?:fetch\s*\(|supabase\.[a-zA-Z0-9_.]+\s*\(|axios\.[a-zA-Z0-9_.]+\s*\()[^;]*;?$/.test(line);

        if (isFloatingAsync) {
          // If the line starts with await, return, void, const, let, var, or assignment, it is fine
          const isGuarded = /^(?:await\b|return\b|void\b|const\b|let\b|var\b|\w+\s*=)/.test(line);
          if (!isGuarded) {
            this.addFinding({
              id: 'LOGIC-FLOATING-PROMISE',
              severity: Severity.HIGH,
              title: 'Floating Unawaited Async Operation',
              message: `Asynchronous call "${line}" is executed without 'await', 'return', or explicit void handler. This causes unhandled rejections and out-of-order execution race conditions.`,
              file: relFile,
              line: i + 1,
              snippet: getSnippet(content, i + 1),
              evidenceType: EvidenceType.AST_ANALYSIS,
              evidence: line,
              remediation: 'Prefix with `await` if inside an async function, or handle with `.catch(...)` / `void`.'
            });
          }
        }
      }
    }

    return this.findings;
  }
}
