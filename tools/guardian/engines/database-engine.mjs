/**
 * Engine 5: Database & Data-Loss Prevention Engine
 * Scans migrations for destructive commands (DROP TABLE, DROP COLUMN, TRUNCATE),
 * missing Row Level Security (RLS) policies, and unindexed foreign keys.
 */

import fs from 'node:fs';
import path from 'node:path';
import { BaseEngine } from './base-engine.mjs';
import { Severity, EvidenceType } from '../core/types.mjs';
import { getLineAndColumn, getSnippet } from '../core/ast-parser.mjs';

export class DatabaseEngine extends BaseEngine {
  constructor() {
    super({
      id: 'database-data-loss',
      name: 'Database & Data-Loss Prevention Engine',
      description: 'Guards against destructive schema operations, missing RLS policies, and missing foreign key indexes.',
      category: 'Database'
    });
  }

  async run(context) {
    this.findings = [];
    const { rootDir, files } = context;

    // Filter SQL files, migrations, seed files, and DB schema definition scripts
    const sqlFiles = files.filter(f => {
      const lower = f.toLowerCase();
      if (lower.includes('node_modules') || lower.includes('.next') || lower.includes('fixtures')) return false;
      return lower.endsWith('.sql') || lower.includes('/migrations/') || lower.includes('\\migrations\\') || lower.includes('/supabase/');
    });

    for (const relFile of sqlFiles) {
      const fullPath = path.isAbsolute(relFile) ? relFile : path.join(rootDir, relFile);
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      // 1. Destructive Database Commands
      const destructivePatterns = [
        {
          regex: /\bDROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+([a-zA-Z0-9_".]+)/gi,
          severity: Severity.CRITICAL,
          title: 'Destructive Migration: DROP TABLE Detected'
        },
        {
          regex: /\bALTER\s+TABLE\s+[a-zA-Z0-9_".]+\s+DROP\s+COLUMN\s+([a-zA-Z0-9_".]+)/gi,
          severity: Severity.CRITICAL,
          title: 'Destructive Migration: DROP COLUMN Detected'
        },
        {
          regex: /\bTRUNCATE(?:\s+TABLE)?\s+([a-zA-Z0-9_".]+)/gi,
          severity: Severity.CRITICAL,
          title: 'Destructive Command: TRUNCATE TABLE'
        },
        {
          regex: /\bDELETE\s+FROM\s+[a-zA-Z0-9_".]+\s*;/gi,
          severity: Severity.HIGH,
          title: 'Unbounded DELETE Without WHERE Clause'
        }
      ];

      for (const dp of destructivePatterns) {
        let match;
        while ((match = dp.regex.exec(content)) !== null) {
          const { line, column } = getLineAndColumn(content, match.index);
          this.addFinding({
            id: 'DB-DESTRUCTIVE-COMMAND',
            severity: dp.severity,
            title: dp.title,
            message: `Migration or SQL script contains irreversible destructive statement "${match[0].trim()}". Running this will cause permanent data loss.`,
            file: relFile,
            line,
            column,
            snippet: getSnippet(content, line),
            evidenceType: EvidenceType.STATIC,
            evidence: match[0],
            remediation: 'Deprecate columns or soft-delete tables. If dropping is strictly intentional for a dev reset, wrap in a gated script with explicit backups.'
          });
        }
      }

      // 2. Missing Row Level Security (RLS) Policies on Newly Created Tables
      const createTableRegex = /\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
      let tableMatch;
      while ((tableMatch = createTableRegex.exec(content)) !== null) {
        const tableName = tableMatch[1];
        // Check if RLS is enabled for this table anywhere in the file
        const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
        const hasRls = rlsRegex.test(content);

        if (!hasRls) {
          const { line, column } = getLineAndColumn(content, tableMatch.index);
          this.addFinding({
            id: 'DB-MISSING-RLS',
            severity: Severity.CRITICAL,
            title: `Table Created Without Row Level Security (RLS): ${tableName}`,
            message: `Table '${tableName}' is created without 'ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;'. In PostgreSQL / Supabase, tables without RLS are exposed to anonymous public access via API.`,
            file: relFile,
            line,
            column,
            snippet: getSnippet(content, line),
            evidenceType: EvidenceType.STATIC,
            evidence: `CREATE TABLE ${tableName} lacking matching ENABLE ROW LEVEL SECURITY`,
            remediation: `Append to migration:\nALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "${tableName}_user_policy" ON ${tableName} FOR ALL USING (auth.uid() = user_id);`
          });
        }
      }

      // 3. Unindexed Foreign Keys
      const fkRegex = /FOREIGN\s+KEY\s*\(([a-zA-Z0-9_]+)\)\s+REFERENCES\s+([a-zA-Z0-9_]+)\s*\(([a-zA-Z0-9_]+)\)/gi;
      let fkMatch;
      while ((fkMatch = fkRegex.exec(content)) !== null) {
        const fkColumn = fkMatch[1];
        const indexRegex = new RegExp(`CREATE\\s+INDEX[\\s\\S]*?\\([\\s\\S]*?\\b${fkColumn}\\b[\\s\\S]*?\\)`, 'i');
        const hasIndex = indexRegex.test(content);

        if (!hasIndex) {
          const { line } = getLineAndColumn(content, fkMatch.index);
          this.addFinding({
            id: 'DB-UNINDEXED-FOREIGN-KEY',
            severity: Severity.MEDIUM,
            title: `Unindexed Foreign Key Column: ${fkColumn}`,
            message: `Foreign key '${fkColumn}' lacks an index in this migration file. Unindexed foreign keys cause full-table locks during cascading updates/deletes and degrade JOIN performance.`,
            file: relFile,
            line,
            snippet: getSnippet(content, line),
            evidenceType: EvidenceType.STATIC,
            evidence: fkMatch[0],
            remediation: `Add index: CREATE INDEX idx_${fkColumn} ON <table>(${fkColumn});`
          });
        }
      }
    }

    return this.findings;
  }
}
