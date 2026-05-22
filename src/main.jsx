import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { seedDatabase } from './utils/sampleData.js'
import { AuthProvider } from './context/AuthContext.jsx'
import { Browser } from '@capacitor/browser'

// Start seeding in background (won't block UI)
seedDatabase().catch(err => console.error(err));

// Intercept external links inside native app to open in external browser
if (window.Capacitor && window.Capacitor.isNativePlatform()) {
  document.addEventListener('click', async (e) => {
    const anchor = e.target.closest('a');
    if (anchor && anchor.href) {
      try {
        const url = new URL(anchor.href);
        const isExternal = url.hostname !== window.location.hostname && !url.hostname.includes('localhost');
        const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
        
        if (isExternal && isHttp && !anchor.hasAttribute('download')) {
          e.preventDefault();
          await Browser.open({ url: anchor.href });
        }
      } catch (err) {
        console.error("Error intercepting/opening URL:", err);
      }
    }
  }, true);
}

// Render immediately
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
