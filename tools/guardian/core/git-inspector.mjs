/**
 * Zero-Dependency Git Inspector
 * Gathers modified/staged files, diffs, and checks protected file boundaries
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { ProtectedFiles } from './types.mjs';

export function getGitStatus(cwd = process.cwd()) {
  try {
    const raw = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    });

    const lines = raw.trim().split('\n').filter(Boolean);
    const modified = [];
    const staged = [];
    const untracked = [];
    const deleted = [];

    for (const line of lines) {
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.slice(3).trim();

      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(filePath);
      } else {
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push(filePath);
        }
        if (workTreeStatus === 'M') {
          modified.push(filePath);
        } else if (workTreeStatus === 'D') {
          deleted.push(filePath);
        }
      }
    }

    return {
      isGitRepo: true,
      modified: Array.from(new Set([...modified, ...staged])),
      staged,
      untracked,
      deleted
    };
  } catch {
    return {
      isGitRepo: false,
      modified: [],
      staged: [],
      untracked: [],
      deleted: []
    };
  }
}

/**
 * Parses git diff to identify added/changed lines per file
 */
export function getGitDiffLines(cwd = process.cwd()) {
  try {
    const rawDiff = execSync('git diff HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    });

    const fileDiffs = new Map();
    const chunks = rawDiff.split(/^diff --git /m);

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const fileMatch = chunk.match(/^a\/(.*?)\s+b\/(.*?)$/m);
      if (!fileMatch) continue;
      const targetFile = fileMatch[2];

      const addedLines = [];
      const lines = chunk.split('\n');
      let currentLineNum = 0;

      for (const line of lines) {
        const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkMatch) {
          currentLineNum = parseInt(hunkMatch[1], 10);
          continue;
        }

        if (line.startsWith('+') && !line.startsWith('+++')) {
          addedLines.push({
            lineNumber: currentLineNum,
            content: line.slice(1)
          });
          currentLineNum++;
        } else if (line.startsWith(' ') || line.startsWith('-')) {
          if (!line.startsWith('---')) {
            currentLineNum++;
          }
        }
      }

      fileDiffs.set(targetFile, addedLines);
    }

    return fileDiffs;
  } catch {
    return new Map();
  }
}

/**
 * Checks if any protected files are modified or deleted
 */
export function checkProtectedBoundaryViolations(changedFiles = []) {
  const violations = [];

  for (const changed of changedFiles) {
    const normalized = changed.replace(/\\/g, '/');
    for (const prot of ProtectedFiles) {
      if (normalized === prot || normalized.endsWith('/' + prot)) {
        violations.push({
          file: changed,
          protectedTarget: prot
        });
      }
    }
  }

  return violations;
}
