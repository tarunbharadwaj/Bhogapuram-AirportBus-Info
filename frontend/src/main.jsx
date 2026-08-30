import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initializeAnalytics } from './lib/analytics.js';
import { applyPageMetadata } from './lib/seo.js';

applyPageMetadata();
initializeAnalytics();

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
