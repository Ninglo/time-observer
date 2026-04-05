#!/usr/bin/env node

const { execFileSync } = require('child_process');

const GIST_ID = '1dc49b8714cfebb11624078f58d88d3b';
const GIST_FILE = 'time-observer-init.json';

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || !['add', 'remove'].includes(command)) {
    throw new Error('Usage: node scripts/meal-gist.js <add|remove> [options]');
  }

  const payload = fetchGistPayload();
  const data = payload.data || payload;
  data.meals = Array.isArray(data.meals) ? data.meals : [];

  if (command === 'add') {
    const meal = buildMealRecord(args);
    data.meals.push(meal);
    updateGist({ version: 3, exportedAt: new Date().toISOString(), data: data });
    process.stdout.write(JSON.stringify(meal, null, 2) + '\n');
    return;
  }

  if (command === 'remove') {
    const id = args.id;
    if (!id) throw new Error('remove requires --id');
    data.meals = data.meals.filter(function(item) { return item.id !== id; });
    updateGist({ version: 3, exportedAt: new Date().toISOString(), data: data });
    process.stdout.write(JSON.stringify({ removed: id }, null, 2) + '\n');
  }
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      result._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      i += 1;
    }
  }
  return result;
}

function fetchGistPayload() {
  const content = execGh(['api', 'gists/' + GIST_ID, '--jq', `.files["${GIST_FILE}"].content`]);
  return JSON.parse(content);
}

function updateGist(payload) {
  const body = JSON.stringify({
    files: {
      [GIST_FILE]: {
        content: JSON.stringify(payload)
      }
    }
  });
  execGh(['api', '--method', 'PATCH', 'gists/' + GIST_ID, '--input', '-'], body);
}

function buildMealRecord(args) {
  const raw = args.json ? JSON.parse(args.json) : {
    dayKey: args.day || todayKey(),
    mealType: args.type || 'snack',
    summary: args.summary || '',
    calories: Number(args.calories) || 0,
    protein: Number(args.protein) || 0,
    confidence: args.confidence || 'AI 估算',
    source: 'ai',
    items: args.items ? JSON.parse(args.items) : []
  };

  if (!raw.summary) throw new Error('add requires --summary or --json');

  return {
    id: raw.id || ('meal_' + Date.now().toString(36)),
    dayKey: raw.dayKey || todayKey(),
    mealType: raw.mealType || 'snack',
    summary: raw.summary,
    calories: Number(raw.calories) || 0,
    protein: Number(raw.protein) || 0,
    confidence: raw.confidence || 'AI 估算',
    source: raw.source || 'ai',
    items: Array.isArray(raw.items) ? raw.items : [],
    note: raw.note || '',
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

function execGh(args, input) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input: input || undefined
  }).trim();
}

function todayKey() {
  const now = new Date();
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
}

function pad(value) {
  return String(value).padStart(2, '0');
}

main();
