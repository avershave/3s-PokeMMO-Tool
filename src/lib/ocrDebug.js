// Whether Options → OCR Debug is on. It saves the helper's captures and shows OCR confidence
// on the live screens. The setting lives in the main process (window.app.getOcrImageDebug);
// OptionsMenu announces changes with OCR_DEBUG_EVENT.
import { useEffect, useState } from 'react';

export const OCR_DEBUG_EVENT = 'ocr-debug-changed';

export function announceOcrDebug(enabled) {
  window.dispatchEvent(new CustomEvent(OCR_DEBUG_EVENT, { detail: { enabled: !!enabled } }));
}

export function useOcrDebug() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve(window.app?.getOcrImageDebug?.())
      .then(res => { if (active && res && res.ok !== false) setEnabled(!!res.enabled); })
      .catch(() => {});
    const onChange = e => setEnabled(!!e.detail?.enabled);
    window.addEventListener(OCR_DEBUG_EVENT, onChange);
    return () => { active = false; window.removeEventListener(OCR_DEBUG_EVENT, onChange); };
  }, []);

  return enabled;
}
