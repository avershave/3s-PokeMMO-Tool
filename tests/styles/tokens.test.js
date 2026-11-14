// tests/styles/tokens.test.js
import { readFileSync } from 'node:fs';
const css = readFileSync('src/index.css', 'utf8') + readFileSync('src/styles/tokens.css', 'utf8');
const app = readFileSync('src/App.jsx', 'utf8');

test('no theme selectors remain', () => { expect(css).not.toMatch(/\.theme-[a-z]+/); });
test('style C palette is defined', () => {
  for (const [k, v] of Object.entries({ '--c-bg':'#23262D', '--c-sidebar':'#1C1F25', '--c-surface':'#2C3038',
    '--c-line':'#353A44', '--c-text':'#E9EAEE', '--c-muted':'#8A8F9C', '--c-live':'#7BD88F' }))
    expect(css).toMatch(new RegExp(`${k}:\\s*${v}`, 'i'));
});
test('legacy variables point at style C', () => {
  expect(css).toMatch(/--bg:\s*var\(--c-bg\)/);
  expect(css).toMatch(/--divider:\s*var\(--c-line\)/);
});
test('the app no longer applies or offers themes', () => {
  expect(app).not.toMatch(/ThemeButton|theme-\$\{|classList\.add\(`theme-/);
});
