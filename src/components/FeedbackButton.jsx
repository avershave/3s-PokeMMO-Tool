import { useEffect, useRef, useState } from 'react';

export default function FeedbackButton({ variant }) {
  const sidebar = variant === 'sidebar';
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const btnStyle = {
    position: 'fixed',
    right: 80,
    bottom: 10,
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid var(--divider)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-1)',
    zIndex: 10000
  };

  const windowStyle = {
    position: 'fixed',
    right: 12,
    bottom: 50,
    maxWidth: 300,
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--divider)',
    borderRadius: 10,
    padding: 16,
    boxShadow: 'var(--shadow-2)',
    zIndex: 10000,
    textAlign: 'center'
  };

  // Beside the sidebar instead of the bottom-right corner.
  const sidebarWindowStyle = { ...windowStyle, right: 'auto', left: 212, bottom: 12 };

  return (
    <div ref={ref}>
      {sidebar ? (
        <button type="button" className="shell-row" onClick={() => setOpen(v => !v)}>Feedback</button>
      ) : (
        <button style={btnStyle} onClick={() => setOpen(v => !v)}>Feedback</button>
      )}
      {open && (
        <div style={sidebar ? sidebarWindowStyle : windowStyle}>
          Find a bug or want a feature added? Any feedback is greatly appreciated! You can message me on Discord @ bkummer3
        </div>
      )}
    </div>
  );
}
