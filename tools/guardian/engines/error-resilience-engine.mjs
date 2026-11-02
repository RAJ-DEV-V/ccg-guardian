/**
 * Engine 8: Error-Handling & Resilience Engine
 * Ensures user-facing actions provide visual progress indicators and actionable error states,
 * eliminating silent UI dead ends.
 */

import fs from 'node:fs';
import path from 'node:path';
import { BaseEngine } from './base-engine.mjs';
import { Severity, EvidenceType } from '../core/types.mjs';
import { getLineAndColumn, getSnippet } from '../core/ast-parser.mjs';

export class ErrorResilienceEngine extends BaseEngine {
  constructor() {
    super({
      id: 'error-resilience',
      name: 'Error-Handling & Resilience Engine',
      description: 'Guarantees actionable error messages and explicit loading states on user interactions.',
      category: 'Resilience'
    });
  }

  async run(context) {
    this.findings = [];
    const { rootDir, files } = context;
    const targetFiles = this.filterFiles(files, ['.tsx', '.jsx']);

    for (const relFile of targetFiles) {
      const fullPath = path.isAbsolute(relFile) ? relFile : path.join(rootDir, relFile);
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      // 1. Silent UI: Empty onClick Handlers (Buttons that do nothing when clicked)
      const emptyOnClickRegex = /onClick\s*=\s*\{\s*(?:\(\)\s*=>\s*\{\s*\}|\(\)\s*=>\s*undefined|\(\)\s*=>\s*null)\s*\}/g;
      let emptyMatch;
      while ((emptyMatch = emptyOnClickRegex.exec(content)) !== null) {
        const { line } = getLineAndColumn(content, emptyMatch.index);
        this.addFinding({
          id: 'ERR-SILENT-EMPTY-ONCLICK',
          severity: Severity.HIGH,
          title: 'Empty onClick Handler (Dead Interactive Element)',
          message: 'Interactive button/element has an empty or no-op onClick handler. Users clicking this element will experience a frozen or unresponsive UI.',
          file: relFile,
          line,
          snippet: getSnippet(content, line),
          evidenceType: EvidenceType.AST_ANALYSIS,
          evidence: emptyMatch[0],
          remediation: 'Implement functional logic or remove the interactive handler until the feature is implemented.'
        });
      }

      // 2. Interactive Forms / Async Buttons Lacking Loading State Indicators
      const hasFormOrAsyncButton = /<(?:form|Button|button)[\s\S]*?(?:onSubmit|onClick)\s*=\s*\{(?:\s*async|\s*\w+)/.test(content);
      if (hasFormOrAsyncButton) {
        const hasLoadingState = /(?:loading|isLoading|isPending|disabled\s*=\s*\{[^}]*load|spinner|Loader)/i.test(content);
        const hasFeedbackMechanism = /(?:toast\b|alert\b|setError|error\b|message\b)/i.test(content);

        if (!hasLoadingState && !hasFeedbackMechanism) {
          this.addFinding({
            id: 'ERR-MISSING-ACTION-FEEDBACK',
            severity: Severity.MEDIUM,
            title: 'Interactive Form/Action Missing Loading State or Error Feedback',
            message: `Component '${relFile}' triggers async actions without visual pending/disabled state or error notification. Users have no indication of background progress.`,
            file: relFile,
            evidenceType: EvidenceType.AST_ANALYSIS,
            evidence: 'Async user action without loading state or error toast feedback',
            remediation: 'Add `isLoading` indicator to disable button during execution and display an error alert/toast on failure.'
          });
        }
      }
    }

    return this.findings;
  }
}
