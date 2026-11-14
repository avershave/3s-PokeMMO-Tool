export function isOcrEnabled() {
  try { return JSON.parse(localStorage.getItem('ocrEnabled') ?? 'true'); }
  catch { return true; }
}

class LiveRouteClient {
  constructor(){
    this.ws = null;
    this.listeners = new Set();
    this.reconnectTimer = null;
    this.pathToggle = false;
    this.lastMsgTs = 0;
    this.lastPayload = null; // cache last message
    this.disabled = !isOcrEnabled();
  }
  connect(){
    if (this.disabled || !isOcrEnabled()) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    try{
      const url = this.pathToggle ? 'ws://127.0.0.1:8765/live/' : 'ws://127.0.0.1:8765/live';
      this.ws = new WebSocket(url);

      this.ws.onmessage = (ev) => {
        this.lastMsgTs = Date.now();
        let payload = ev.data;
        try { payload = JSON.parse(ev.data); } catch {}
        this.lastPayload = payload; // cache
        this.listeners.forEach(fn => fn(payload));
      };
      const onClose = () => {
        this.pathToggle = !this.pathToggle;
        if (!this.disabled && isOcrEnabled()) this.scheduleReconnect();
      };
      this.ws.onclose = onClose;
      this.ws.onerror = onClose;
    }catch{
      if (!this.disabled && isOcrEnabled()) this.scheduleReconnect();
    }
  }
  on(fn){
    this.listeners.add(fn);
    // Immediately replay last message so the tab shows data when you return
    if (this.lastPayload !== null) {
      try { fn(this.lastPayload); } catch {}
    }
    return () => this.listeners.delete(fn);
  }
  scheduleReconnect(){
    if (this.disabled || !isOcrEnabled()) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(()=> {
      this.reconnectTimer = null;
      this.connect();
    }, 1500);
  }
  isOpen(){
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
  forceReconnect(){
    try { if (this.ws) this.ws.close(); } catch {}
    this.ws = null;
    this.lastPayload = null;          // <-- clear cached message so UI resets
    // Clear any pending reconnect to avoid residual timers after a manual restart
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (!this.disabled && isOcrEnabled()) setTimeout(()=> this.connect(), 100);
  }
  setEnabled(enabled){
    this.disabled = !enabled;
    if (this.disabled) {
      try { if (this.ws) this.ws.close(); } catch {}
      this.ws = null;
      this.lastPayload = null;
    } else {
      this.connect();
    }
  }
}
export const liveRouteClient = new LiveRouteClient();

class LiveBattleClient {
  constructor(){
    this.ws = null;
    this.listeners = new Set();
    this.reconnectTimer = null;
    this.pathToggle = false;
    this.lastMsgTs = 0;
    this.lastPayload = null;
    this.disabled = !isOcrEnabled();
  }
  connect(){
    if (this.disabled || !isOcrEnabled()) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    try{
      const url = this.pathToggle ? 'ws://127.0.0.1:8765/battle/' : 'ws://127.0.0.1:8765/battle';
      this.ws = new WebSocket(url);
      this.ws.onmessage = (ev) => {
        this.lastMsgTs = Date.now();
        let payload = ev.data;
        try { payload = JSON.parse(ev.data); } catch {}
        this.lastPayload = payload;
        this.listeners.forEach(fn => fn(payload));
      };
      const onClose = () => {
        this.pathToggle = !this.pathToggle;
        if (!this.disabled && isOcrEnabled()) this.scheduleReconnect();
      };
      this.ws.onclose = onClose;
      this.ws.onerror = onClose;
    }catch{
      if (!this.disabled && isOcrEnabled()) this.scheduleReconnect();
    }
  }
  on(fn){
    this.listeners.add(fn);
    if (this.lastPayload !== null) {
      try { fn(this.lastPayload); } catch {}
    }
    return () => this.listeners.delete(fn);
  }
  scheduleReconnect(){
    if (this.disabled || !isOcrEnabled()) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(()=> {
      this.reconnectTimer = null;
      this.connect();
    }, 1500);
  }
  isOpen(){
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
  forceReconnect(){
    try { if (this.ws) this.ws.close(); } catch {}
    this.ws = null;
    this.lastPayload = null;
    this.pathToggle = !this.pathToggle;
    if (!this.disabled && isOcrEnabled()) setTimeout(()=> this.connect(), 100);
  }
  setEnabled(enabled){
    this.disabled = !enabled;
    if (this.disabled) {
      try { if (this.ws) this.ws.close(); } catch {}
      this.ws = null;
      this.lastPayload = null;
    } else {
      this.connect();
    }
  }
}
export const liveBattleClient = new LiveBattleClient();
