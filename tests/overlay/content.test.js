// Validates the hand-written overlay content in tags/story.json and tags/tips.json
// against the real dex (UpdatedDex.json).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const dex = readJson('UpdatedDex.json');
const byId = new Map(dex.map(m => [m.id, m]));
const story = readJson('tags/story.json');
const tips = readJson('tags/tips.json');
const words = s => s.trim().split(/\s+/).filter(Boolean).length;

test('story has 100-150 entries with unique ids', () => {
  const ids = story.entries.map(e => e.id);
  expect(ids.length).toBeGreaterThanOrEqual(100);
  expect(ids.length).toBeLessThanOrEqual(150);
  expect(new Set(ids).size).toBe(ids.length);
});

test('every story id is an obtainable Pokémon in the dex', () => {
  for (const e of story.entries) {
    expect(Number.isInteger(e.id), `id ${e.id}`).toBe(true);
    expect(byId.get(e.id)?.obtainable, `story id ${e.id}`).toBe(true);
  }
});

test('every story summary is at most 5 words and every body is filled in', () => {
  for (const e of story.entries) {
    expect(typeof e.summary).toBe('string');
    expect(words(e.summary), `summary for ${e.id}: "${e.summary}"`).toBeGreaterThan(0);
    expect(words(e.summary), `summary for ${e.id}: "${e.summary}"`).toBeLessThanOrEqual(5);
    expect(typeof e.body).toBe('string');
    expect(e.body.trim().length, `body for ${e.id}`).toBeGreaterThan(40);
  }
});

test('tips has 15-30 entries keyed by obtainable dex ids', () => {
  const keys = Object.keys(tips);
  expect(keys.length).toBeGreaterThanOrEqual(15);
  expect(keys.length).toBeLessThanOrEqual(30);
  for (const k of keys) {
    expect(String(Number(k)), `tip key ${k}`).toBe(k);
    expect(byId.get(Number(k))?.obtainable, `tip key ${k}`).toBe(true);
    expect(typeof tips[k]).toBe('string');
    expect(tips[k].trim().length, `tip for ${k}`).toBeGreaterThan(20);
  }
});
