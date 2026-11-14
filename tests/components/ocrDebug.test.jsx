// @vitest-environment jsdom
import { render, screen, act } from '@testing-library/react';
import { useOcrDebug, announceOcrDebug } from '../../src/lib/ocrDebug.js';

function Probe() {
  return <span>{useOcrDebug() ? 'debug on' : 'debug off'}</span>;
}

afterEach(() => { delete window.app; });

test('off by default when the bridge is missing', () => {
  render(<Probe />);
  expect(screen.getByText('debug off')).toBeTruthy();
});

test('reads the saved setting from the app bridge', async () => {
  window.app = { getOcrImageDebug: async () => ({ ok: true, enabled: true }) };
  render(<Probe />);
  expect(await screen.findByText('debug on')).toBeTruthy();
});

test('follows changes announced from Options', async () => {
  window.app = { getOcrImageDebug: async () => ({ ok: true, enabled: false }) };
  render(<Probe />);
  await act(async () => {});
  act(() => announceOcrDebug(true));
  expect(screen.getByText('debug on')).toBeTruthy();
  act(() => announceOcrDebug(false));
  expect(screen.getByText('debug off')).toBeTruthy();
});
