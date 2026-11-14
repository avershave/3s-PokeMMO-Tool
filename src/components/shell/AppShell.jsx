import { useEffect, useState } from 'react';
import Sidebar from './Sidebar.jsx';
import { isNarrowNow, UI_SCALE_EVENT } from '../../lib/uiScale.js';
import './shell.css';

// Sidebar on the left, page content in a scrolling main area. Below 900 layout
// px (window width divided by UI scale) the sidebar hides behind a menu button
// and opens as an overlay (see .shell--narrow in shell.css).
export default function AppShell({ mode, onNavigate, onAction, ocrSupported, ocrEnabled, onOpenLive, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [narrow, setNarrow] = useState(isNarrowNow);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const update = () => {
      const next = isNarrowNow();
      setNarrow(next);
      if (!next) setMenuOpen(false); // the overlay menu only exists when narrow
    };
    update(); // the Options menu may have applied the saved scale since first render
    window.addEventListener('resize', update);
    window.addEventListener(UI_SCALE_EVENT, update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener(UI_SCALE_EVENT, update);
    };
  }, []);

  return (
    <div className={`shell${narrow ? ' shell--narrow' : ''}${menuOpen ? ' shell--menu-open' : ''}`}>
      <Sidebar
        mode={mode}
        ocrSupported={ocrSupported}
        ocrEnabled={ocrEnabled}
        onNavigate={(m) => { closeMenu(); onNavigate(m); }}
        onAction={(item) => { closeMenu(); onAction(item); }}
        onOpenLive={() => { closeMenu(); onOpenLive?.(); }}
      />
      <div className="shell-backdrop" aria-hidden="true" onClick={closeMenu} />
      <main className="shell-main">
        <button
          type="button"
          className="shell-menu-btn"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>
        {children}
      </main>
    </div>
  );
}
