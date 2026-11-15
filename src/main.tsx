import {createRoot} from 'react-dom/client';
import '@fontsource/tinos/latin-400.css';
import '@fontsource/tinos/latin-400-italic.css';
import '@fontsource/tinos/latin-700.css';
import '@fontsource/tinos/latin-700-italic.css';
import '@fontsource/tinos/greek-400.css';
import '@fontsource/tinos/greek-700.css';
import '@fontsource/tinos/latin-ext-400.css';
import '@fontsource/tinos/latin-ext-700.css';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Register Service Worker for offline PWA installation
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
} else if ('serviceWorker' in navigator) {
  // In dev / preview environment
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
