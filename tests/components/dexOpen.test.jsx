// @vitest-environment jsdom
import { render, screen, act, cleanup } from '@testing-library/react';
import AlphaDexButton from '../../src/components/AlphaDexButton.jsx';
import CaughtListButton from '../../src/components/CaughtListButton.jsx';
import { AlphaCaughtContext } from '../../src/alphaCaughtContext.js';
import { CaughtContext } from '../../src/caughtContext.js';
import { openDex } from '../../src/lib/nav.js';

afterEach(cleanup);

function Providers({ children }) {
  return (
    <CaughtContext.Provider value={{ caught: new Set(), toggleCaught() {}, replaceCaught() {} }}>
      <AlphaCaughtContext.Provider value={{ alphaCaught: new Set(), toggleAlphaCaught() {} }}>
        {children}
      </AlphaCaughtContext.Provider>
    </CaughtContext.Provider>
  );
}

test('hidden trigger renders no button', () => {
  render(<Providers><AlphaDexButton renderTrigger={false} /></Providers>);
  expect(screen.queryByRole('button', { name: /alpha dex/i })).toBeNull();
});

test('default still renders the trigger button', () => {
  render(<Providers><AlphaDexButton /></Providers>);
  expect(screen.getByRole('button', { name: /alpha dex/i })).toBeTruthy();
});

test('open-dex opens only the matching window', () => {
  render(
    <Providers>
      <AlphaDexButton renderTrigger={false} />
      <CaughtListButton renderTrigger={false} />
    </Providers>
  );
  act(() => openDex('alpha'));
  expect(screen.getByText('Alpha Dex')).toBeTruthy();
  expect(screen.queryByText(/Total caught/i)).toBeNull();
});
