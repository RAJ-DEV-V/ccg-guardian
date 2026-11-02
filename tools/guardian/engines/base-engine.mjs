/**
 * Base Engine Class for Engineering Guardian Subsystems
 */

import { Severity, EvidenceType, createFinding } from '../core/types.mjs';

export class BaseEngine {
  constructor({ id, name, description, category }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.category = category;
    this.findings = [];
  }

  addFinding({
    id,
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
    const finding = createFinding({
      id: id || `${this.id}-${this.findings.length + 1}`,
      engine: this.id,
      category: this.category,
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
      requiresHumanAction
    });
    this.findings.push(finding);
    return finding;
  }

  filterFiles(files, allowedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
    return files.filter(f => {
      const lower = f.toLowerCase().replace(/\\/g, '/');
      // Skip node_modules, build outputs, reports, and synthetic test fixtures by default
      if (lower.includes('node_modules') || lower.includes('.next') || lower.includes('dist') || lower.includes('fixtures') || lower.startsWith('reports/')) {
        return false;
      }
      return allowedExtensions.some(ext => lower.endsWith(ext));
    });
  }

  async run(_context) {
    throw new Error(`Engine ${this.name} must implement run(context)`);
  }
}
