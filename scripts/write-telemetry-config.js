#!/usr/bin/env node
// Writes resources/telemetry.config.json from POKEMMO_TOOL_TELEMETRY_* env vars.
// Without POKEMMO_TOOL_TELEMETRY_URL (e.g. a fork with no telemetry secrets) it writes an
// empty config, and the app skips telemetry ("telemetry endpoint not configured").
const fs = require('fs');
const path = require('path');

function normalize(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length ? trimmed : '';
}

const config = {};

const installUrl = normalize(process.env.POKEMMO_TOOL_TELEMETRY_URL);
if (installUrl) {
  config.POKEMMO_TOOL_TELEMETRY_URL = installUrl;

  const optionalKeys = [
    'POKEMMO_TOOL_TELEMETRY_KEY',
    'POKEMMO_TOOL_TELEMETRY_TOKEN',
    'POKEMMO_TOOL_TELEMETRY_STATS_URL',
    'POKEMMO_TOOL_TELEMETRY_STATS_KEY',
    'POKEMMO_TOOL_TELEMETRY_STATS_TOKEN',
  ];

  for (const key of optionalKeys) {
    const value = normalize(process.env[key]);
    if (value) {
      config[key] = value;
    }
  }
}

const repoRoot = path.resolve(__dirname, '..');
const resourcesDir = path.join(repoRoot, 'resources');
const outputPath = path.join(resourcesDir, 'telemetry.config.json');

fs.mkdirSync(resourcesDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

if (!installUrl) {
  console.log('[telemetry-config] POKEMMO_TOOL_TELEMETRY_URL not set; telemetry disabled (wrote empty config).');
} else {
  const maskedKeys = Object.keys(config).map((key) => {
    if (!key.endsWith('_KEY') && !key.endsWith('_TOKEN')) return key;
    return `${key} (${config[key].length} chars)`;
  });
  console.log(`[telemetry-config] wrote telemetry.config.json with keys: ${maskedKeys.join(', ')}`);
}
