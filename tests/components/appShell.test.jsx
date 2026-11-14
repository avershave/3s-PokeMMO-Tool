// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import App from '../../src/App.jsx';
test('app opens on Pokémon search inside the sidebar shell', () => {
  localStorage.setItem('theme', 'white');
  render(<App />);
  expect(screen.getByRole('button', { name: 'Pokémon' }).getAttribute('aria-current')).toBe('page');
  expect(document.documentElement.className).not.toMatch(/theme-/);
  expect(document.body.className).not.toMatch(/theme-/);
  expect(screen.queryByText('Pokemon Search')).toBeNull(); // old segmented button gone
});
