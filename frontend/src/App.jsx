import { useEffect, useState } from 'react';
import { api } from './lib/api.js';
import AdminPage from './pages/AdminPage.jsx';
import HomePage from './pages/HomePage.jsx';
import { LoadingScreen } from './components/SiteSections.jsx';

export default function App() {
  const [service, setService] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/api/service').then(setService).catch((err) => setError(err.message)); }, []);
  if (error) return <LoadingScreen error={error} />;
  if (!service) return <LoadingScreen />;
  return window.location.pathname === '/service-admin' ? <AdminPage service={service} onSaved={setService} /> : <HomePage service={service} />;
}
