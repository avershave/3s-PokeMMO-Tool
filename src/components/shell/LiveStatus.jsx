import { useEffect, useState } from 'react';
import { liveRouteClient } from '../../lib/liveClients.js';

const POLL_MS = 1000;

// The helper sends each update in several formats; only the object forms
// ({ text } or { route }) carry the route. Returns null for other messages.
export function routeFromMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const raw = typeof msg.text === 'string' ? msg.text : typeof msg.route === 'string' ? msg.route : null;
  if (raw === null) return null;
  const route = raw.trim();
  return route === 'NO_ROUTE' ? '' : route;
}

export default function LiveStatus({ client = liveRouteClient, onOpen }) {
  const [open, setOpen] = useState(() => client.isOpen());
  const [route, setRoute] = useState('');

  useEffect(() => client.on((msg) => {
    const next = routeFromMessage(msg);
    if (next !== null) setRoute(next);
  }), [client]);

  // The status shows from launch, before the Route page has connected the
  // client. connect() is idempotent and respects the OCR on/off setting. After
  // that first call the client retries every 1.5 s itself, so the poll below
  // only reads the state.
  useEffect(() => {
    client.connect?.();
    const id = setInterval(() => {
      const isOpen = client.isOpen();
      setOpen(isOpen);
      if (!isOpen) setRoute('');
    }, POLL_MS);
    return () => clearInterval(id);
  }, [client]);

  return (
    <button type="button" className="shell-live" onClick={onOpen}>
      {open ? (
        <>
          <span className="shell-live__head">
            <span className="shell-live__dot" aria-hidden="true" />
            <span className="shell-live__title">Reading PokeMMO</span>
          </span>
          <span className="shell-live__route">{route || 'No route detected'}</span>
        </>
      ) : (
        <span className="shell-live__title shell-live__title--off">Helper not connected</span>
      )}
    </button>
  );
}
