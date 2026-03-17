import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/**
 * 🛡️ CONSOLE NOISE SHIELD
 * Silences non-app errors (extensions, library deprecations) for a pristine console experience.
 */
const SILENCED_MESSAGES = [
  'THREE.Clock',
  'THREE.Timer',
  'Backpack',
  'ethereum',
  'connectionId',
  'Could not establish connection',
  'Receiving end does not exist',
  'site.webmanifest',
  'SES Removing',
  'Begin Wallet'
];

const shouldSilence = (args) => {
  const msg = args.map(a => a?.toString() || "").join(" ");
  return SILENCED_MESSAGES.some(term => msg.includes(term));
};

const originalWarn = console.warn;
console.warn = (...args) => {
  if (shouldSilence(args)) return;
  originalWarn(...args);
};

const originalError = console.error;
console.error = (...args) => {
  if (shouldSilence(args)) return;
  originalError(...args);
};

// Also catch uncaught promise rejections from extensions
window.addEventListener('unhandledrejection', (event) => {
  if (shouldSilence([event.reason])) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
