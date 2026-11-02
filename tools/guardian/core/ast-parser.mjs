/**
 * Zero-Dependency Lexical & Structural AST Code Scanner
 * Parses JS, TS, JSX, TSX files using native Node.js patterns and lexical state machines.
 */

/**
 * Strips comments from code while preserving newline structure (line numbers unchanged)
 */
export function stripComments(code) {
  let result = '';
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += '\n';
      } else {
        result += ' ';
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        result += '  ';
        i++;
      } else if (char === '\n') {
        result += '\n';
      } else {
        result += ' ';
      }
      continue;
    }

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }

    // Check for comment starts
    if (char === '/' && next === '/') {
      inLineComment = true;
      result += '  ';
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      result += '  ';
      i++;
      continue;
    }

    // Check for string starts
    if (char === '\'' || char === '"' || char === '`') {
      inString = char;
      result += char;
      continue;
    }

    result += char;
  }

  return result;
}

/**
 * Convert character index to 1-based line number and column number
 */
export function getLineAndColumn(content, index) {
  let line = 1;
  let lastNewline = -1;

  for (let i = 0; i < Math.min(index, content.length); i++) {
    if (content[i] === '\n') {
      line++;
      lastNewline = i;
    }
  }

  const column = index - lastNewline;
  return { line, column };
}

/**
 * Extract context snippet surrounding a line number
 */
export function getSnippet(content, lineNumber, contextLines = 1) {
  const lines = content.split('\n');
  const targetIdx = lineNumber - 1;
  const start = Math.max(0, targetIdx - contextLines);
  const end = Math.min(lines.length - 1, targetIdx + contextLines);

  const snippetLines = [];
  for (let i = start; i <= end; i++) {
    const prefix = i === targetIdx ? ' > ' : '   ';
    snippetLines.push(`${prefix}${String(i + 1).padStart(4)}: ${lines[i]}`);
  }
  return snippetLines.join('\n');
}

/**
 * Extract all imported modules from a file (ES6 imports and CommonJS requires)
 */
export function extractImports(code) {
  const imports = [];
  const cleanCode = stripComments(code);

  // Match: import ... from '...' or import '...'
  const importRegex = /(?:import\s+(?:(?:\*\s+as\s+\w+|[\w\s{},]+)\s+from\s+)?['"]([^'"]+)['"])|(?:require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
  let match;

  while ((match = importRegex.exec(cleanCode)) !== null) {
    const specifier = match[1] || match[2];
    const { line, column } = getLineAndColumn(code, match.index);
    imports.push({
      specifier,
      index: match.index,
      line,
      column,
      statement: match[0]
    });
  }

  return imports;
}

/**
 * Find catch blocks and identify if they are empty or lack logging/rethrow
 */
export function findCatchBlocks(code) {
  const clean = stripComments(code);
  const catchRegex = /catch\s*(?:\(([^)]*)\))?\s*\{/g;
  const results = [];
  let match;

  while ((match = catchRegex.exec(clean)) !== null) {
    const startIndex = match.index;
    const errParam = (match[1] || '').trim();
    const openBraceIdx = match.index + match[0].length - 1;

    // Find closing brace matching openBraceIdx
    let depth = 1;
    let endBraceIdx = -1;
    for (let i = openBraceIdx + 1; i < clean.length; i++) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') {
        depth--;
        if (depth === 0) {
          endBraceIdx = i;
          break;
        }
      }
    }

    if (endBraceIdx !== -1) {
      const body = clean.slice(openBraceIdx + 1, endBraceIdx).trim();
      const { line, column } = getLineAndColumn(code, startIndex);
      const originalBody = code.slice(openBraceIdx + 1, endBraceIdx).trim();

      const hasLogging = /console\.(error|warn|log|info)|logger|captureException|reportError/i.test(body);
      const hasThrow = /\bthrow\b/.test(body);
      const hasFallback = /\breturn\b|\bset\w+\s*\(/.test(body);
      const isEmpty = body.length === 0 || body === ';';

      results.push({
        line,
        column,
        errParam,
        body: originalBody,
        isEmpty,
        hasLogging,
        hasThrow,
        hasFallback,
        isSwallowed: isEmpty || (!hasLogging && !hasThrow && !hasFallback)
      });
    }
  }

  return results;
}

/**
 * Find loop scopes in code
 */
export function findLoops(code) {
  const clean = stripComments(code);
  const loopRegex = /\b(?:for\s*\([^)]*\)|while\s*\([^)]*\)|(?:\.\s*(?:forEach|map|flatMap|reduce)\s*\([^)]*\)))\s*\{/g;
  const loops = [];
  let match;

  while ((match = loopRegex.exec(clean)) !== null) {
    const startIndex = match.index;
    const openBraceIdx = match.index + match[0].length - 1;

    let depth = 1;
    let endBraceIdx = -1;
    for (let i = openBraceIdx + 1; i < clean.length; i++) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') {
        depth--;
        if (depth === 0) {
          endBraceIdx = i;
          break;
        }
      }
    }

    if (endBraceIdx !== -1) {
      const { line } = getLineAndColumn(code, startIndex);
      loops.push({
        start: startIndex,
        end: endBraceIdx,
        startLine: line,
        header: match[0],
        body: code.slice(openBraceIdx + 1, endBraceIdx)
      });
    }
  }

  return loops;
}

/**
 * Detect dead code following unconditional return/throw/break/continue
 */
export function findUnreachableCode(code) {
  const clean = stripComments(code);
  const deadCodeInstances = [];
  const lines = clean.split('\n');

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    // Check if line ends with unconditional return/throw/break/continue
    const isTerminator = /^(?:return|throw\s+new\s+\w+|throw\s+\w+|break|continue)(?:;|\s+[^;{]+;?)$/.test(line);
    if (isTerminator) {
      // Look ahead for reachable statements before a closing brace
      let nextIdx = i + 1;
      while (nextIdx < lines.length) {
        const nextLine = lines[nextIdx].trim();
        if (!nextLine || nextLine === '}' || nextLine.startsWith('case ') || nextLine === 'default:') {
          break; // Empty or block terminator, fine
        }
        if (nextLine.startsWith('//') || nextLine.startsWith('/*')) {
          nextIdx++;
          continue;
        }

        // We found an executable statement right after unconditional return!
        deadCodeInstances.push({
          line: nextIdx + 1,
          terminatorLine: i + 1,
          code: nextLine
        });
        break;
      }
    }
  }

  return deadCodeInstances;
}
