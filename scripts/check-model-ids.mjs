#!/usr/bin/env node
/**
 * Checks each provider's /v1/models endpoint against our config.
 * Outputs a report of stale/missing models and optionally patches config.ts.
 *
 * Usage:
 *   GROQ_API_KEY=... OPENROUTER_API_KEY=... CEREBRAS_API_KEY=... GEMINI_API_KEY=... node scripts/check-model-ids.mjs
 *
 * Flags:
 *   --patch   Rewrite config.ts, removing models that no longer exist
 *   --json    Output machine-readable JSON report
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../src/config.ts');
const PATCH = process.argv.includes('--patch');
const JSON_OUT = process.argv.includes('--json');

// ── Provider API fetchers ────────────────────────────────────────────────────

async function fetchGroqModels() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return new Set(data.data.map((m) => m.id));
}

async function fetchOpenRouterModels() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return new Set(data.data.map((m) => m.id));
}

async function fetchCerebrasModels() {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.cerebras.ai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return new Set(data.data.map((m) => m.id));
}

async function fetchGeminiModels() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  // Gemini model names look like "models/gemini-1.5-pro" — strip prefix
  return new Set(data.models.map((m) => m.name.replace('models/', '')));
}

// ── Parse current config ─────────────────────────────────────────────────────

function parseConfigModels() {
  const src = readFileSync(CONFIG_PATH, 'utf-8');
  const models = [];
  // Match each object in DEFAULT_MODELS array
  const blockRe = /\{[^}]*?id:\s*'([^']+)'[^}]*?provider:\s*'([^']+)'[^}]*?model:\s*'([^']+)'[^}]*?\}/gs;
  let match;
  while ((match = blockRe.exec(src)) !== null) {
    models.push({ id: match[1], provider: match[2], model: match[3] });
  }
  return models;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [groq, openrouter, cerebras, gemini] = await Promise.all([
    fetchGroqModels(),
    fetchOpenRouterModels(),
    fetchCerebrasModels(),
    fetchGeminiModels(),
  ]);

  const providerSets = { groq, openrouter, cerebras, gemini };
  const configModels = parseConfigModels();

  const report = { stale: [], ok: [], skipped: [] };

  for (const entry of configModels) {
    const set = providerSets[entry.provider];
    if (set === null || set === undefined) {
      report.skipped.push({ ...entry, reason: 'no API key / fetch failed' });
      continue;
    }
    if (set.has(entry.model)) {
      report.ok.push(entry);
    } else {
      report.stale.push(entry);
    }
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (report.stale.length === 0) {
      console.log(`✓ All ${report.ok.length} checked models are valid (${report.skipped.length} skipped)`);
    } else {
      console.log(`⚠ ${report.stale.length} stale model(s) found:\n`);
      for (const m of report.stale) {
        console.log(`  ${m.provider}/${m.model}  (id: ${m.id})`);
      }
      console.log(`\n✓ ${report.ok.length} valid, ${report.skipped.length} skipped`);
    }
  }

  // ── Patch config if requested ──────────────────────────────────────────
  if (PATCH && report.stale.length > 0) {
    let src = readFileSync(CONFIG_PATH, 'utf-8');
    for (const m of report.stale) {
      // Remove the entire object block for this model id
      const escaped = m.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const objRe = new RegExp(
        `\\s*\\{[^}]*?id:\\s*'${escaped}'[^}]*?\\},?\\n?`,
        'g'
      );
      src = src.replace(objRe, '\n');

      // Also remove the corresponding limit entry
      const limitKey = `${m.provider}:${m.model}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const limitRe = new RegExp(`\\s*'${limitKey}':\\s*\\{[^}]*\\},?\\n?`, 'g');
      src = src.replace(limitRe, '\n');
    }
    // Clean up double newlines
    src = src.replace(/\n{3,}/g, '\n\n');
    writeFileSync(CONFIG_PATH, src);
    console.log(`\nPatched config.ts — removed ${report.stale.length} stale model(s)`);
  }

  // Exit with code 1 if stale models found AND we didn't patch — signals CI to act.
  // When --patch is used, patching IS the success action, so exit 0.
  if (report.stale.length > 0 && !PATCH) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
