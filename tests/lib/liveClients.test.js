import { afterAll, test, expect } from 'vitest';
import { liveRouteClient, liveBattleClient } from '../../src/lib/liveClients.js';

afterAll(() => {
  liveRouteClient.setEnabled(false);
  liveBattleClient.setEnabled(false);
});

test('clients expose the subscription API', () => {
  for (const c of [liveRouteClient, liveBattleClient]) {
    const off = c.on(() => {});
    expect(typeof off).toBe('function');
    expect(typeof c.isOpen()).toBe('boolean');
    off();
  }
});
