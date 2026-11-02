/**
 * Engine 2: Security & Vulnerability Engine
 * Scans for hardcoded credentials, SQL injection, IDOR, unprotected admin endpoints,
 * and unsanitized HTML sinks.
 */

import fs from 'node:fs';
import path from 'node:path';
import { BaseEngine } from './base-engine.mjs';
import { Severity, EvidenceType } from '../core/types.mjs';
import { getLineAndColumn, getSnippet } from '../core/ast-parser.mjs';

export class SecurityEngine extends BaseEngine {
  constructor() {
    super({
      id: 'security-vulnerability',
      name: 'Security & Vulnerability Engine',
      description: 'Scans for hardcoded secrets, SQL injection, IDOR, unprotected endpoints, and XSS sinks.',
      category: 'Security'
    });
  }

  isPlaceholder(value) {
    const lower = value.toLowerCase();
    const placeholders = [
      'placeholder', 'your_key', 'your-key', 'example', 'dummy', 'mock',
      'changeme', 'xxxx', '123456', '000000', '<key>', '${', 'test-key'
    ];
    return placeholders.some(p => lower.includes(p));
  }

  async run(context) {
    this.findings = [];
    const { rootDir, files } = context;
    const targetFiles = this.filterFiles(files, ['.ts', '.tsx', '.js', '.jsx', '.json', '.env']);

    for (const relFile of targetFiles) {
      const fullPath = path.isAbsolute(relFile) ? relFile : path.join(rootDir, relFile);
      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      // Skip scanning .env.example or test files for secrets
      const isExampleOrTest = relFile.endsWith('.env.example') ||
                              relFile.includes('.test.') ||
                              relFile.includes('.spec.');

      // 1. Hardcoded Secret Patterns
      if (!isExampleOrTest) {
        const secretPatterns = [
          {
            name: 'AWS Access Key ID',
            regex: /\b(AKIA[0-9A-Z]{16})\b/g,
            severity: Severity.CRITICAL
          },
          {
            name: 'Generic Private Key',
            regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
            severity: Severity.CRITICAL
          },
          {
            name: 'GitHub Personal Access Token',
            regex: /\b(ghp_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{22,})\b/g,
            severity: Severity.CRITICAL
          },
          {
            name: 'Hardcoded High-Entropy Secret Assignment',
            regex: /(?:api_?key|secret|password|access_?token)\s*[:=]\s*['"]([A-Za-z0-9_\-]{24,})['"]/gi,
            severity: Severity.HIGH,
            extractGroup: 1
          }
        ];

        for (const pattern of secretPatterns) {
          let match;
          while ((match = pattern.regex.exec(content)) !== null) {
            const secretValue = pattern.extractGroup ? match[pattern.extractGroup] : match[0];
            if (this.isPlaceholder(secretValue)) {
              continue;
            }

            const { line, column } = getLineAndColumn(content, match.index);
            this.addFinding({
              id: 'SEC-HARDCODED-SECRET',
              severity: pattern.severity,
              title: `Hardcoded Credential Detected: ${pattern.name}`,
              message: `Potentially active secret detected in source file: '${pattern.name}'. Hardcoded secrets can be harvested by malicious actors or crawlers.`,
              file: relFile,
              line,
              column,
              snippet: getSnippet(content, line),
              evidenceType: EvidenceType.STATIC,
              evidence: `Matched token pattern: ${pattern.name}`,
              remediation: `1. Move the secret to an environment variable in .env.local.\n2. Add placeholder in .env.example.\n3. ROTATE THE EXPOSED KEY IMMEDIATELY at the provider console. Deleting the line does not invalidate the leaked token!`,
              requiresHumanAction: true
            });
          }
        }
      }

      // 2. SQL Injection Patterns
      // Check for raw SQL query interpolation or template literals constructing SQL
      const sqlInjectionPatterns = [
        {
          regex: /(?:\$queryRawUnsafe|\.query|\.execute)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/g,
          title: 'SQL Injection via Template Literal in Raw Query'
        },
        {
          regex: /(?:\$queryRawUnsafe|\.query|\.execute)\s*\(\s*['"][^'"]*['"]\s*\+\s*[a-zA-Z0-9_.]+/g,
          title: 'SQL Injection via String Concatenation in Raw Query'
        },
        {
          regex: /`\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+[^`]*\$\{[^}]+\}[^`]*`/gi,
          title: 'SQL Injection via Template Literal in SQL Query String'
        },
        {
          regex: /supabase\.rpc\s*\(\s*['"][^'"]+['"]\s*,\s*\{[^}]*sql\s*:\s*[`'"][^`'"]*\$/g,
          title: 'Raw Dynamic SQL in Supabase RPC'
        }
      ];

      for (const sqlp of sqlInjectionPatterns) {
        let match;
        while ((match = sqlp.regex.exec(content)) !== null) {
          const { line, column } = getLineAndColumn(content, match.index);
          this.addFinding({
            id: 'SEC-SQL-INJECTION',
            severity: Severity.CRITICAL,
            title: sqlp.title,
            message: 'Dynamic untrusted variables are interpolated directly into SQL statements without parameterization, exposing the database to SQL injection attacks.',
            file: relFile,
            line,
            column,
            snippet: getSnippet(content, line),
            evidenceType: EvidenceType.AST_ANALYSIS,
            evidence: match[0],
            remediation: 'Use parameterized queries with positional placeholders ($1, $2 or ?) or ORM query builders (e.g. prisma.$queryRaw`...` or supabase.from(...).select(...)). Never concatenate raw strings into SQL.'
          });
        }
      }

      // 3. IDOR Vulnerabilities
      // API routes accepting an ID from params/body and deleting/updating without verifying user identity/ownership
      const isApiRoute = relFile.includes('/api/') || relFile.includes('\\api\\');
      if (isApiRoute) {
        const hasIdParam = /(?:params\.(?:id|userId|docId)|body\.(?:id|userId|docId)|searchParams\.get\(['"]id['"]\))/.test(content);
        const hasMutation = /\b(?:DELETE|UPDATE|PATCH|POST)\b|\.(?:delete|update)\s*\(/.test(content);
        const hasAuthOwnershipCheck = /(?:auth\.getUser|getSession|session\.user|user_id|created_by|owner_id|verifyUser|requireAuth)/.test(content);

        if (hasIdParam && hasMutation && !hasAuthOwnershipCheck) {
          this.addFinding({
            id: 'SEC-IDOR-SUSPECT',
            severity: Severity.HIGH,
            title: `Potential Insecure Direct Object Reference (IDOR): ${relFile}`,
            message: `API endpoint processes object identifier from client request without apparent ownership verification or user session constraint. Any authenticated or unauthenticated caller may mutate arbitrary records.`,
            file: relFile,
            evidenceType: EvidenceType.AST_ANALYSIS,
            evidence: 'Mutation endpoint accesses target id without user session ownership filter',
            remediation: 'Enforce ownership verification: ensure the query includes `user_id = session.user.id` or check user permissions before executing the mutation.'
          });
        }

        // 4. Missing Authorization on Administrative Endpoints
        const isAdminRoute = relFile.includes('/api/admin/') || relFile.includes('\\api\\admin\\');
        if (isAdminRoute) {
          const hasAdminVerification = /(?:isAdmin|verifyAdmin|requireRole|role\s*===\s*['"]admin['"]|auth\.getUser\(\))/i.test(content);
          if (!hasAdminVerification) {
            this.addFinding({
              id: 'SEC-ADMIN-UNPROTECTED',
              severity: Severity.CRITICAL,
              title: `Unprotected Administrative Endpoint: ${relFile}`,
              message: `Administrative route in /api/admin/ lacks server-side admin role or session verification.`,
              file: relFile,
              evidenceType: EvidenceType.AST_ANALYSIS,
              evidence: 'No admin role validation found in administrative route handler',
              remediation: 'Verify caller authentication and check that user role is strictly \'admin\' before executing administrative logic.'
            });
          }
        }
      }

      // 5. Unsanitized HTML Sinks (XSS)
      const xssRegex = /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*([^}]+)\s*\}\s*\}/g;
      let xssMatch;
      while ((xssMatch = xssRegex.exec(content)) !== null) {
        const innerExpression = xssMatch[1].trim();
        const hasSanitizer = /DOMPurify\.sanitize|sanitizeHtml|escapeHtml/i.test(innerExpression);
        if (!hasSanitizer) {
          const { line, column } = getLineAndColumn(content, xssMatch.index);
          this.addFinding({
            id: 'SEC-XSS-UNSANITIZED-HTML',
            severity: Severity.HIGH,
            title: 'Unsanitized HTML Sink (Cross-Site Scripting)',
            message: `dangerouslySetInnerHTML renders dynamic expression '${innerExpression}' without explicit sanitization, risking stored or reflected XSS vulnerabilities.`,
            file: relFile,
            line,
            column,
            snippet: getSnippet(content, line),
            evidenceType: EvidenceType.AST_ANALYSIS,
            evidence: xssMatch[0],
            remediation: 'Wrap dynamic HTML content with DOMPurify.sanitize(...) before injecting it into the DOM.'
          });
        }
      }
    }

    return this.findings;
  }
}
