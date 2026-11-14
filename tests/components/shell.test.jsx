// @vitest-environment jsdom
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import AppShell from '../../src/components/shell/AppShell.jsx';
import LiveStatus from '../../src/components/shell/LiveStatus.jsx';
import PatchNotesButton from '../../src/components/PatchNotesButton.jsx';
import FeedbackButton from '../../src/components/FeedbackButton.jsx';
import SponsorButton from '../../src/components/SponsorButton.jsx';

afterEach(cleanup);

const fakeClient = (open, msg) => { let fn; return { isOpen: () => open, on: f => { fn = f; return () => {}; }, emit: (m = msg) => fn?.(m) }; };

test('navigates by mode and marks the active row', () => {
  const onNavigate = vi.fn();
  render(<AppShell mode="pokemon" onNavigate={onNavigate} onAction={() => {}} ocrSupported ocrEnabled><p>page</p></AppShell>);
  expect(screen.getByRole('button', { name: 'Pokémon' }).getAttribute('aria-current')).toBe('page');
  fireEvent.click(screen.getByRole('button', { name: 'Areas' }));
  expect(onNavigate).toHaveBeenCalledWith('areas');
});
test('dex and type chart go through onAction', () => {
  const onAction = vi.fn();
  render(<AppShell mode="pokemon" onNavigate={() => {}} onAction={onAction} ocrSupported={false}><p /></AppShell>);
  fireEvent.click(screen.getByRole('button', { name: 'Type chart' }));
  expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'type-chart' }));
});
test('no live group or status without OCR', () => {
  render(<AppShell mode="pokemon" onNavigate={() => {}} onAction={() => {}} ocrSupported={false}><p /></AppShell>);
  expect(screen.queryByText('Battle')).toBeNull();
  expect(screen.queryByText(/Reading PokeMMO|Helper not connected/)).toBeNull();
});
test('no live group or status when OCR is turned off', () => {
  render(<AppShell mode="pokemon" onNavigate={() => {}} onAction={() => {}} ocrSupported ocrEnabled={false}><p /></AppShell>);
  expect(screen.queryByText('Battle')).toBeNull();
  expect(screen.queryByText(/Reading PokeMMO|Helper not connected/)).toBeNull();
});
test('live status reflects the helper', () => {
  const c = fakeClient(true, { type: 'route', text: 'Route 35' });
  render(<LiveStatus client={c} onOpen={() => {}} />);
  act(() => c.emit());
  expect(screen.getByText('Reading PokeMMO')).toBeTruthy();
  expect(screen.getByText('Route 35')).toBeTruthy();
});
test('live status when the helper is down', () => {
  render(<LiveStatus client={fakeClient(false)} onOpen={() => {}} />);
  expect(screen.getByText('Helper not connected')).toBeTruthy();
});
test('live status reads the route field and ignores NO_ROUTE and plain text', () => {
  const c = fakeClient(true);
  render(<LiveStatus client={c} onOpen={() => {}} />);
  expect(screen.getByText('No route detected')).toBeTruthy();
  act(() => c.emit({ route: '  Route 12 ' }));
  expect(screen.getByText('Route 12')).toBeTruthy();
  act(() => c.emit('ROUTE|Route 12'));
  expect(screen.getByText('Route 12')).toBeTruthy();
  act(() => c.emit({ type: 'route', text: 'NO_ROUTE' }));
  expect(screen.getByText('No route detected')).toBeTruthy();
});
test('live status polls the connection and opens on click', () => {
  vi.useFakeTimers();
  try {
    let open = false;
    const c = { isOpen: () => open, on: () => () => {} };
    const onOpen = vi.fn();
    render(<LiveStatus client={c} onOpen={onOpen} />);
    expect(screen.getByText('Helper not connected')).toBeTruthy();
    open = true;
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Reading PokeMMO')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Reading PokeMMO/ }));
    expect(onOpen).toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
test('settings group holds the moved buttons', () => {
  render(<AppShell mode="pokemon" onNavigate={() => {}} onAction={() => {}} ocrSupported={false}><p /></AppShell>);
  for (const name of ['Options', 'Patch notes', 'Resources', 'Sponsor', 'Feedback'])
    expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeTruthy();
});
test('resources row goes through onAction', () => {
  const onAction = vi.fn();
  render(<AppShell mode="pokemon" onNavigate={() => {}} onAction={onAction} ocrSupported={false}><p /></AppShell>);
  fireEvent.click(screen.getByRole('button', { name: 'Resources' }));
  expect(onAction).toHaveBeenCalledWith({ id: 'resources', action: 'resources' });
});
test('narrow layout has a menu button and items still navigate', () => {
  const onNavigate = vi.fn();
  render(<AppShell mode="pokemon" onNavigate={onNavigate} onAction={() => {}} ocrSupported={false}><p /></AppShell>);
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hordes' }));
  expect(onNavigate).toHaveBeenCalledWith('horde');
});
test('footer components keep their default triggers', () => {
  render(<><PatchNotesButton /><FeedbackButton /><SponsorButton /></>);
  expect(screen.getByRole('button', { name: 'Patch Notes' }).style.borderRadius).toBe('10px');
  expect(screen.getByRole('button', { name: 'Feedback' }).style.position).toBe('fixed');
  expect(screen.getByRole('button', { name: 'Sponsor' }).style.borderRadius).toBe('10px');
});
