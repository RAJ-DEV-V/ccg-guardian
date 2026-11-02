/**
 * Synthetic Verification Testbed for Engineering Guardian (CCG / CCEG)
 * Proves that each of the 10 engines accurately detects defects in violating code
 * and produces zero false alarms on clean, safe code.
 * 
 * credits to developer rajvansh mishra, backend developer, lovely professional university
 * github: https://github.com/RAJ-DEV-V
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { ArchitectureEngine } from '../engines/architecture-engine.mjs';
import { SecurityEngine } from '../engines/security-engine.mjs';
import { LogicEngine } from '../engines/logic-engine.mjs';
import { PerformanceEngine } from '../engines/performance-engine.mjs';
import { DatabaseEngine } from '../engines/database-engine.mjs';
import { RegressionEngine } from '../engines/regression-engine.mjs';
import { ConcurrencyEngine } from '../engines/concurrency-engine.mjs';
import { ErrorResilienceEngine } from '../engines/error-resilience-engine.mjs';
import { SupplyChainEngine } from '../engines/supply-chain-engine.mjs';
import { BuildHealthEngine } from '../engines/build-health-engine.mjs';
import { Severity } from '../core/types.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create an isolated temporary testing sandbox
function createSandbox() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-test-'));
  return {
    dir: tempDir,
    writeFile: (relPath, content) => {
      const fullPath = path.join(tempDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
      return relPath;
    },
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('   🧪 ENGINEERING GUARDIAN: 10-ENGINE SYNTHETIC VERIFICATION');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // TEST 1: Architecture & Boundaries Engine
  // -------------------------------------------------------------
  console.log('▶ Testing Engine 1: Architecture & Boundaries');
  {
    const sb = createSandbox();
    const violationFile = sb.writeFile('components/ClientCard.tsx', `
      'use client';
      import fs from 'node:fs';
      export default function ClientCard() {
        const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
        return <div>Card {secret}</div>;
      }
    `);
    const cleanFile = sb.writeFile('components/SafeCard.tsx', `
      'use client';
      export default function SafeCard() {
        const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        return <div>Safe {publicUrl}</div>;
      }
    `);

    const engine = new ArchitectureEngine();
    const findings = await engine.run({
      rootDir: sb.dir,
      files: [violationFile, cleanFile],
      changedFiles: []
    });

    const secretLeak = findings.find(f => f.id === 'ARCH-SECRET-LEAK-CLIENT');
    const forbiddenImport = findings.find(f => f.id === 'ARCH-FORBIDDEN-CLIENT-IMPORT');
    const cleanFindings = findings.filter(f => f.file === cleanFile);

    assert(secretLeak !== undefined, 'Accurately detects SUPABASE_SERVICE_ROLE_KEY leaked in client component');
    assert(forbiddenImport !== undefined, 'Accurately detects forbidden server module (node:fs) imported in client component');
    assert(cleanFindings.length === 0, 'Clean client component produces ZERO false alarms');
    sb.cleanup();
  }

  // -------------------------------------------------------------
  // TEST 2: Security & Vulnerability Engine
  // -------------------------------------------------------------
  console.log('\n▶ Testing Engine 2: Security & Vulnerability');
  {
    const sb = createSandbox();
    const violationFile = sb.writeFile('app/api/charge/route.ts', `
      export async function POST(req) {
        const hardcodedKey = "AKIAIOSFODNN7XYZW9Q2";
        const query = \`SELECT * FROM users WHERE id = \${req.id}\`;
        const html = \`<div dangerouslySetInnerHTML={{ __html: req.body.rawContent }} />\`;
        return { hardcodedKey, query, html };
      }
    `);
    const cleanFile = sb.writeFile('app/api/clean/route.ts', `
      import DOMPurify from 'dompurify';
      export async function POST(req) {
        const placeholderKey = "your-api-key-placeholder";
        const safeQuery = db.query('SELECT * FROM users WHERE id = $1', [req.id]);
        const safeHtml = \`<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(req.body.content) }} />\`;
        return { safeQuery, safeHtml, placeholderKey };
      }
    `);

    const engine = new SecurityEngine();
    const findings = await engine.run({
      rootDir: sb.dir,
      files: [violationFile, cleanFile]
    });

    assert(findings.some(f => f.id === 'SEC-HARDCODED-SECRET'), 'Accurately detects live hardcoded AWS access key');
    assert(findings.some(f => f.id === 'SEC-SQL-INJECTION'), 'Accurately detects raw SQL injection string interpolation');
    assert(findings.some(f => f.id === 'SEC-XSS-UNSANITIZED-HTML'), 'Accurately detects unsanitized dangerouslySetInnerHTML');

    const cleanFindings = findings.filter(f => f.file === cleanFile);
    assert(cleanFindings.length === 0, 'Clean parameterized code and placeholder credentials produce ZERO false alarms');
    sb.cleanup();
  }

  // -------------------------------------------------------------
  // TEST 3: Logic & Execution-Path Tracer Engine
  // -------------------------------------------------------------
  console.log('\n▶ Testing Engine 3: Logic & Execution-Path Tracer');
  {
    const sb = createSandbox();
    const violationFile = sb.writeFile('services/sync.ts', `
      export async function syncData() {
        fetch('https://api.example.com/sync'); // floating unawaited promise
        try {
          doWork();
        } catch (err) {} // empty swallowed catch
        return true;
        console.log("unreachable dead code"); // dead branch
      }
    `);
    const cleanFile = sb.writeFile('services/cleanSync.ts', `
      export async function cleanSync() {
        await fetch('https://api.example.com/sync');
        try {
          doWork();
        } catch (err) {
          console.error("Sync failed:", err);
        }
        return true;
      }
    `);

    const engine = new LogicEngine();
    const findings = await engine.run({
      rootDir: sb.dir,
      files: [violationFile, cleanFile]
    });

    assert(findings.some(f => f.id === 'LOGIC-FLOATING-PROMISE'), 'Accurately detects floating unawaited async fetch call');
    assert(findings.some(f => f.id === 'LOGIC-SWALLOWED-CATCH'), 'Accurately detects empty swallowed catch block');
    assert(findings.some(f => f.id === 'LOGIC-DEAD-CODE'), 'Accurately detects unreachable dead code after return');

    const cleanFindings = findings.filter(f => f.file === cleanFile);
    assert(cleanFindings.length === 0, 'Clean awaited async functions and logged catches produce ZERO false alarms');
    sb.cleanup();
  }

  // -------------------------------------------------------------
  // TEST 4: Performance & Denial-of-Wallet Engine
  // -------------------------------------------------------------
  console.log('\n▶ Testing Engine 4: Performance & Denial-of-Wallet (Resource Gate)');
  {
    const sb = createSandbox();
    const violationFile = sb.writeFile('app/api/process/route.ts', `
      export async function GET() {
        for (const id of [1, 2, 3]) {
          await supabase.from('users').select('*'); // N+1 query loop
        }
        setInterval(() => { refresh(); }, 250); // aggressive runaway timer
        const all = await supabase.from('logs').select('*'); // unbounded query
        return { all };
      }
    `);
    const cleanFile = sb.writeFile('app/api/cleanProcess/route.ts', `
      export async function GET() {
        const batch = await supabase.from('users').select('*').in('id', [1, 2, 3]).limit(50);
        setInterval(() => { refresh(); }, 5000);
        return { batch };
      }
    `);

    const engine = new PerformanceEngine();
    const findings = await engine.run({
      rootDir: sb.dir,
      files: [violationFile, cleanFile]
    });

    assert(findings.some(f => f.id === 'PERF-N-PLUS-ONE-LOOP'), 'Accurately detects N+1 database query inside loop');
    assert(findings.some(f => f.id === 'PERF-RUNAWAY-INTERVAL'), 'Accurately detects runaway sub-second polling interval (<1000ms)');
    assert(findings.some(f => f.id === 'PERF-UNBOUNDED-SELECT'), 'Accurately detects unbounded SELECT * query without LIMIT');

    const cleanFindings = findings.filter(f => f.file === cleanFile);
    assert(cleanFindings.length === 0, 'Batched queries and bounded timers produce ZERO false alarms');
    sb.cleanup();
  }

  // -------------------------------------------------------------
  // TEST 5: Database & Data-Loss Prevention Engine
  // -------------------------------------------------------------
  console.log('\n▶ Testing Engine 5: Database & Data-Loss Prevention');
  {
    const sb = createSandbox();
    const violationFile = sb.writeFile('supabase/migrations/001_destructive.sql', `
      DROP TABLE students CASCADE;
      TRUNCATE TABLE logs;
      CREATE TABLE accounts (
        id uuid primary key,
        user_id uuid references users(id)
      );
    `);
    const cleanFile = sb.writeFile('supabase/migrations/002_safe.sql', `
      CREATE TABLE safe_items (
        id uuid primary key,
        owner_id uuid references users(id)
      );
      ALTER TABLE safe_items ENABLE ROW LEVEL SECURITY;
      CREATE INDEX idx_owner_id ON safe_items(owner_id);
    `);

    const engine = new DatabaseEngine();
    const findings = await engine.run({
      rootDir: sb.dir,
      files: [violationFile, cleanFile]
    });

    assert(findings.some(f => f.id === 'DB-DESTRUCTIVE-COMMAND' && f.title.includes('DROP TABLE')), 'Accurately detects destructive DROP TABLE migration');
    assert(findings.some(f => f.id === 'DB-DESTRUCTIVE-COMMAND' && f.title.includes('TRUNCATE')), 'Accurately detects destructive TRUNCATE TABLE command');
    assert(findings.some(f => f.id === 'DB-MISSING-RLS'), 'Accurately flags newly created table missing Row Level Security (RLS)');

    const cleanFindings = findings.filter(f => f.file === cleanFile);
    assert(cleanFindings.length === 0, 'Safe migrations with RLS enabled and indexed keys produce ZERO false alarms');
    sb.cleanup();
  }

  // -------------------------------------------------------------
  // TEST 6: Regression & Blast-Radius Engine
  // -------------------------------------------------------------
  console.log('\n▶ Testing Engine 6: Regression & Blast-Radius Engine');
  {
    const sb = createSandbox();
    const utilFile = sb.writeFile('lib/utils.ts', 'export function cn(...inputs) { return inputs.join(" "); }');
    const compFiles = [];
    for (let i = 1; i <= 6; i++) {
      compFiles.push(sb.writeFile(`components/Component${i}.tsx`, `import { cn } from '@/lib/utils';`));
    }
    const isolatedFile = sb.writeFile('components/Isolated.tsx', `export const Leaf = () => <div>Leaf</div>;`);

    const engine = new RegressionEngine();
    const findings = await engine.run({
      rootDir: sb.dir,
      files: [utilFile, ...compFiles, isolatedFile],
      changedFiles: [utilFile, isolatedFile]
    });

    const highBlastFinding = findings.find(f => f.id === 'REGR-HIGH-BLAST-RADIUS');
    assert(highBlastFinding !== undefined, 'Accurately calculates high blast radius for core utility (>= 5 dependents)');
    assert(!findings.some(f => f.file === isolatedFile), 'Isolated leaf component with 0 dependents does not trigger blast alert');
    sb.cleanup();
  }

  // -------------------------------------------------------------
  // TEST 7: Concurrency & Race-Condition Engine
  // -------------------------------------------------------------
  console.log('\n▶ Testing Engine 7: Concurrency & Race-Condition Engine');
  {
    const sb = createSandbox();
    const violationFile = sb.writeFile('app/api/race/route.ts', `
      import fs from 'node:fs';
      export async function POST(req) {
        if (fs.existsSync('cache.json')) {
          fs.writeFileSync('cache.json', 'data');
        }
        const user = await db.findUnique({ where: { id: req.id } });
        const newBalance = user.balance - 10;
        await db.update({ where: { id: req.id }, data: { balance: newBalance } });
        return { ok: true };
      }
    `);
    const cleanFile = sb.writeFile('app/api/safeConcurrent/route.ts', `
      export async function POST(req) {
        await db.update({
          where: { id: req.id },
          data: { balance: { decrement: 10 } }
        });
        return { ok: true };
      }
    `);

    const engine = new ConcurrencyEngine();
    const findings = await engine.run({
      rootDir: sb.dir,
      files: [violationFile, cleanFile]
    });

    assert(findings.some(f => f.id === 'CONC-TOCTOU-FILE-RACE'), 'Accurately detects TOCTOU file existence-then-write race condition');
    assert(findings.some(f => f.id === 'CONC-READ-MODIFY-WRITE-RACE'), 'Accurately flags non-atomic read-modify-write on balances');

    const cleanFindings = findings.filter(f => f.file === cleanFile);
    assert(cleanFindings.length === 0, 'Atomic database increments/decrements produce ZERO false alarms');
    sb.cleanup();
  }

  // -------------------------------------------------------------
  // TEST 8: Error-Handling & Resilience Engine
  // -------------------------------------------------------------
  console.log('\n▶ Testing Engine 8: Error-Handling & Resilience Engine');
  {
    const sb = createSandbox();
    const violationFile = sb.writeFile('components/DeadButton.tsx', `
      export default function DeadButton() {
        return <button onClick={() => {}}>Do Nothing</button>;
      }
    `);
    const cleanFile = sb.writeFile('components/ResilientButton.tsx', `
      export default function ResilientButton({ isLoading, onClick }) {
        return (
          <button disabled={isLoading} onClick={onClick}>
            {isLoading ? 'Processing...' : 'Submit'}
          </button>
        );
      }
    `);

    const engine = new ErrorResilienceEngine();
    const findings = await engine.run({
      rootDir: sb.dir,
      files: [violationFile, cleanFile]
    });

    assert(findings.some(f => f.id === 'ERR-SILENT-EMPTY-ONCLICK'), 'Accurately detects empty dead onClick button handlers');

    const cleanFindings = findings.filter(f => f.file === cleanFile);
    assert(cleanFindings.length === 0, 'Resilient interactive buttons with loading states produce ZERO false alarms');
    sb.cleanup();
  }

  // -------------------------------------------------------------
  // TEST 9: Supply Chain & Dependency Engine
  // -------------------------------------------------------------
  console.log('\n▶ Testing Engine 9: Supply Chain & Dependency Engine');
  {
    const sb = createSandbox();
    sb.writeFile('package.json', JSON.stringify({
      dependencies: {
        "malicious-wildcard": "*",
        "insecure-source": "http://insecure-cdn.example.com/package.tgz",
        "safe-package": "^2.1.0"
      }
    }));

    const engine = new SupplyChainEngine();
    const findings = await engine.run({
      rootDir: sb.dir,
      files: ['package.json']
    });

    assert(findings.some(f => f.id === 'SUPPLY-UNPINNED-WILDCARD'), 'Accurately detects unpinned dependency wildcard (*)');
    assert(findings.some(f => f.id === 'SUPPLY-INSECURE-PROTOCOL'), 'Accurately flags unencrypted HTTP transport protocol');
    assert(!findings.some(f => f.message.includes('safe-package')), 'Semver pinned HTTPS packages produce ZERO false alarms');
    sb.cleanup();
  }

  // -------------------------------------------------------------
  // TEST 10: Build & Type Health Engine
  // -------------------------------------------------------------
  console.log('\n▶ Testing Engine 10: Build & Type Health Engine');
  {
    const sb = createSandbox();
    sb.writeFile('.env.example', 'DATABASE_URL=postgres://...\nNEXT_PUBLIC_API=https://...');
    const violationFile = sb.writeFile('lib/config.ts', `
      const unlisted = process.env.MY_SECRET_NOT_IN_EXAMPLE;
      const valid = process.env.DATABASE_URL;
      export { unlisted, valid };
    `);

    const engine = new BuildHealthEngine();
    const findings = await engine.run({
      rootDir: sb.dir,
      files: [violationFile]
    });

    assert(findings.some(f => f.id === 'BUILD-UNDECLARED-ENV-VAR'), 'Accurately detects undocumented environment variables absent from .env.example');
    assert(!findings.some(f => f.message.includes('DATABASE_URL')), 'Declared environment variables produce ZERO false alarms');
    sb.cleanup();
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests} / ${totalTests} SYNTHETIC FIXTURE VERIFICATION TESTS PASSED!`);
  console.log('   Accuracy: 100% detection rate | 0% false alarm rate on clean code.');
  console.log('================================================================\n');
  console.log('<small>developed with excellence — credits to developer rajvansh mishra, backend developer, lovely professional university (github: https://github.com/RAJ-DEV-V)</small>\n');
}

runTestSuite().catch(err => {
  console.error('\nVerification Testbed Failed:', err);
  process.exit(1);
});
