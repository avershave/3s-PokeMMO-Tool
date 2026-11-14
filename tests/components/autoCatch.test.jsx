// @vitest-environment jsdom
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import App from '../../src/App.jsx';

afterEach(() => { cleanup(); delete window.app; localStorage.clear(); });

test('a chat-log catch marks the Pokémon caught', () => {
  let onCaught;
  window.app = { onPokemonCaught: (cb) => { onCaught = cb; return () => {}; } };
  render(<App />);
  expect(onCaught).toBeTypeOf('function');
  act(() => onCaught({ pokemonName: 'pikachu', isAlpha: false }));
  expect(JSON.parse(localStorage.getItem('caughtPokemon'))).toContain(25);
  act(() => onCaught({ pokemonName: 'Snubbull', isAlpha: true }));
  expect(JSON.parse(localStorage.getItem('alphaCaughtPokemon'))).toContain(209);
});

test('closing the type chart keeps the current page', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Team Builder' }));
  fireEvent.click(screen.getByRole('button', { name: 'Type chart' }));
  const img = screen.getByAltText('Pokemon type chart');
  fireEvent.click(img.parentElement.parentElement);
  expect(screen.queryByAltText('Pokemon type chart')).toBeNull();
  expect(screen.getByRole('button', { name: 'Team Builder' }).getAttribute('aria-current')).toBe('page');
});
