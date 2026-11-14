import React from 'react';
import { BALL_OPTIONS } from '../../lib/catch.js';

function BallSelect({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = React.useState(null);
  const ref = React.useRef(null);
  const selected = BALL_OPTIONS.find(opt => opt.key === value) || BALL_OPTIONS[0];

  const updateMenuMaxHeight = React.useCallback(() => {
    if (!ref.current) return;
    const wrap = ref.current;
    const container = wrap.closest('.pokemon-profile');
    const button = wrap.querySelector('.profile-ball-select-button');
    const menu = wrap.querySelector('.profile-ball-select-menu');
    if (!container || !button || !menu) {
      setMenuMaxHeight(null);
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    // Account for the 6px gap defined in CSS plus a little breathing room.
    const gap = 10;
    const available = containerRect.bottom - buttonRect.bottom - gap;
    setMenuMaxHeight(Number.isFinite(available) && available > 0 ? available : null);
  }, []);

  React.useEffect(() => {
    function handleClick(e) {
      if (!ref.current || ref.current.contains(e.target)) return;
      setOpen(false);
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    updateMenuMaxHeight();
    const handleResize = () => updateMenuMaxHeight();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [open, updateMenuMaxHeight]);

  React.useEffect(() => {
    if (!open) {
      setMenuMaxHeight(null);
    }
  }, [open]);

  return (
    <div className={`profile-ball-select${open ? ' is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className="profile-ball-select-button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Selected ball: ${selected.label}`}
      >
        <img
          className="profile-ball-icon"
          src={selected.icon}
          alt=""
          aria-hidden="true"
        />
        <span className="profile-ball-select-label">Ball</span>
      </button>
      {open && (
        <div
          className="profile-ball-select-menu"
          role="listbox"
          style={menuMaxHeight ? { maxHeight: menuMaxHeight } : undefined}
        >
          {BALL_OPTIONS.map(opt => (
            <button
              type="button"
              key={opt.key}
              className={`profile-ball-select-option${opt.key === selected.key ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
              role="option"
              aria-selected={opt.key === selected.key}
            >
              <img
                className="profile-ball-icon"
                src={opt.icon}
                alt=""
                aria-hidden="true"
              />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default BallSelect;
