// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import '@fontsource/bricolage-grotesque/500.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import './index.css';

const initialScale = parseInt(localStorage.getItem('uiScaleV2'), 10);
if (Number.isFinite(initialScale)) {
  document.body.style.zoom = initialScale / 100;
} else {
  const legacy = parseInt(localStorage.getItem('uiScale'), 10);
  const migrated = Number.isFinite(legacy)
    ? Math.max(0, Math.min(100, Math.round(legacy / 2)))
    : 50;
  document.body.style.zoom = migrated / 100;
  localStorage.setItem('uiScaleV2', String(migrated));
  localStorage.removeItem('uiScale');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
