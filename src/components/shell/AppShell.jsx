import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import './shell.css';

// Sidebar on the left, page content in a scrolling main area. Below 900px the
// sidebar hides behind a menu button and opens as an overlay (see shell.css).
export default function AppShell({ mode, onNavigate, onAction, ocrSupported, ocrEnabled, onOpenLive, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={`shell${menuOpen ? ' shell--menu-open' : ''}`}>
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
