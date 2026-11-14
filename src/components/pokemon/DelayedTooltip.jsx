import React from 'react';

// Delayed tooltip wrapper for hover content (e.g., item descriptions)
function DelayedTooltip({ content, delay = 1000, maxWidth = 360, children }){
  const [visible, setVisible] = React.useState(false);
  const timerRef = React.useRef(null);
  const resolvedMaxWidth = typeof maxWidth === 'number' ? maxWidth : 360;
  const resolvedMinWidth = Math.min(resolvedMaxWidth, 260);
  const onEnter = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };
  const onLeave = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };
  return (
    <span style={{ position:'relative', display:'inline-flex', alignItems:'center' }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      {visible && content && (
        <span
          style={{
            position:'absolute',
            bottom:'calc(100% + 8px)', left:'50%', transform:'translateX(-50%)',
            maxWidth: resolvedMaxWidth,
            minWidth: resolvedMinWidth,
            background:'var(--surface)', color:'var(--text)',
            border:'1px solid var(--divider)', borderRadius:8,
            padding:'8px 12px', fontSize:12, lineHeight:1.4, boxShadow:'0 6px 20px rgba(0,0,0,.35)',
            zIndex:50, whiteSpace:'normal', textAlign:'left'
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export default DelayedTooltip;
