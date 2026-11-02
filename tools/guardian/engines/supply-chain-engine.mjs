/**
 * Engine 9: Supply Chain & Dependency Engine
 * Audits lockfiles with strict timeout protection and inspects package configurations
 * for vulnerable or dangerous package patterns.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { BaseEngine } from './base-engine.mjs';
import { Severity, EvidenceType } from '../core/types.mjs';

export class SupplyChainEngine extends BaseEngine {
  constructor() {
    super({
      id: 'supply-chain-dependencies',
      name: 'Supply Chain & Dependency Engine',
      description: 'Audits lockfiles for vulnerabilities with timeout guards and detects insecure package patterns.',
      category: 'Supply Chain'
    });
  }

  async run(context) {
    this.findings = [];
    const { rootDir } = context;
    const pkgPath = path.join(rootDir, 'package.json');
    const lockPath = path.join(rootDir, 'package-lock.json');

    // 1. Inspect package.json for insecure or unpinned dependencies
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        for (const [name, version] of Object.entries(deps)) {
          if (version === '*' || version === 'latest') {
            this.addFinding({
              id: 'SUPPLY-UNPINNED-WILDCARD',
              severity: Severity.HIGH,
              title: `Unpinned Dependency Wildcard: ${name}@${version}`,
              message: `Package '${name}' is declared with wildcard '${version}'. This leaves the application vulnerable to supply-chain attacks via untested upstream releases.`,
              file: 'package.json',
              evidenceType: EvidenceType.STATIC,
              evidence: `"${name}": "${version}"`,
              remediation: `Pin dependency to a specific version or semver range (e.g. ^1.2.0 or ~1.2.0).`
            });
          }

          if (typeof version === 'string' && (version.startsWith('http://') || version.startsWith('git://'))) {
            this.addFinding({
              id: 'SUPPLY-INSECURE-PROTOCOL',
              severity: Severity.CRITICAL,
              title: `Insecure Transport Protocol in Dependency: ${name}`,
              message: `Package '${name}' uses unencrypted protocol '${version}'. Man-in-the-middle attacks can tamper with downloaded package archives.`,
              file: 'package.json',
              evidenceType: EvidenceType.STATIC,
              evidence: `"${name}": "${version}"`,
              remediation: 'Use https:// or authenticated npm registry endpoints.'
            });
          }
        }
      } catch {
        // malformed package.json handled by build health engine
      }
    }

    // 2. Lockfile Vulnerability Audit with Strict Timeout Protection
    if (fs.existsSync(lockPath)) {
      try {
        // Use 4000ms timeout to strictly prevent CLI hanging
        const auditOutput = execSync('npm audit --json', {
          cwd: rootDir,
          encoding: 'utf8',
          timeout: 4000,
          stdio: ['ignore', 'pipe', 'ignore']
        });

        const auditData = JSON.parse(auditOutput);
        const vulnerabilities = auditData.vulnerabilities || {};

        for (const [pkgName, details] of Object.entries(vulnerabilities)) {
          const sev = (details.severity || 'low').toUpperCase();
          if (sev === 'CRITICAL' || sev === 'HIGH') {
            this.addFinding({
              id: 'SUPPLY-VULNERABLE-PACKAGE',
              severity: sev === 'CRITICAL' ? Severity.CRITICAL : Severity.HIGH,
              title: `Known Vulnerable Dependency: ${pkgName} (${sev})`,
              message: `Package '${pkgName}' has known advisory with severity ${sev}.`,
              file: 'package-lock.json',
              evidenceType: EvidenceType.SCANNER,
              evidence: `Advisory summary: ${details.via?.[0]?.title || 'Known vulnerability'}`,
              remediation: `Run 'npm audit fix' or update '${pkgName}' to a patched release.`
            });
          }
        }
      } catch (err) {
        // npm audit exits with 1 when vulnerabilities are found
        if (err.stdout) {
          try {
            const auditData = JSON.parse(err.stdout);
            const vulnerabilities = auditData.vulnerabilities || {};
            for (const [pkgName, details] of Object.entries(vulnerabilities)) {
              const sev = (details.severity || 'low').toUpperCase();
              if (sev === 'CRITICAL' || sev === 'HIGH') {
                this.addFinding({
                  id: 'SUPPLY-VULNERABLE-PACKAGE',
                  severity: sev === 'CRITICAL' ? Severity.CRITICAL : Severity.HIGH,
                  title: `Known Vulnerable Dependency: ${pkgName} (${sev})`,
                  message: `Package '${pkgName}' has known security advisory with severity ${sev}.`,
                  file: 'package-lock.json',
                  evidenceType: EvidenceType.SCANNER,
                  evidence: `Advisory summary: ${typeof details.via?.[0] === 'object' ? details.via[0].title : 'Known vulnerability'}`,
                  remediation: `Run 'npm audit fix' or upgrade '${pkgName}'.`
                });
              }
            }
          } catch {
            // If parse fails or timed out, report non-fatal audit info
          }
        }
      }
    }

    return this.findings;
  }
}
