import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { validateStopTrackingSnapshot, validateTrackingSnapshot } from '../lib/liveTracking.js';
import { TRACKING_REFRESH_MS } from '../../../shared/liveTracking.mjs';

export default function useLiveTracking(sectionRef, enabled, stopRequest = null) {
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(document.visibilityState !== 'hidden');
  const [online, setOnline] = useState(navigator.onLine !== false);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const anchor = useRef(null);
  const nextAttempt = useRef(0);
  const active = enabled && visible && foreground && online;
  const query = stopRequest ? new URLSearchParams(Object.entries(stopRequest)
    .filter(([, value]) => value)).toString() : '';
  const endpoint = stopRequest ? `/api/stop-tracking?${query}` : '/api/live-buses';

  useEffect(() => {
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting)) : null;
    if (observer && sectionRef.current) observer.observe(sectionRef.current);
    else setVisible(true);
    const visibility = () => setForeground(document.visibilityState !== 'hidden');
    const connection = () => setOnline(navigator.onLine !== false);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
    };
  }, [sectionRef]);

  useEffect(() => {
    if (!enabled && !snapshot) return;
    const tick = () => setNow(anchor.current
      ? anchor.current.server + Math.max(0, performance.now() - anchor.current.monotonic)
      : Date.now());
    tick();
    const timer = window.setInterval(tick, 10_000);
    return () => window.clearInterval(timer);
  }, [enabled, snapshot]);

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    let cancelled = false;
    let timer;
    let controller;
    let failures = 0;
    const poll = async () => {
      controller = new AbortController();
      // Allow a free Render instance to wake up without blocking the rest of the site.
      const timeout = window.setTimeout(() => controller.abort(), 75_000);
      setLoading(true);
      try {
        const raw = await api(endpoint, { signal: controller.signal });
        const value = stopRequest ? validateStopTrackingSnapshot(raw) : validateTrackingSnapshot(raw);
        if (cancelled) return;
        anchor.current = { server: Date.parse(value.serverTime), monotonic: performance.now() };
        setNow(anchor.current.server);
        setSnapshot(value);
        setError(value.status === 'unavailable');
        failures = value.status === 'unavailable' ? failures + 1 : 0;
      } catch {
        if (cancelled) return;
        setError(true);
        failures += 1;
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) {
          setLoading(false);
          const delay = Math.min(120_000, TRACKING_REFRESH_MS * 2 ** Math.min(failures, 2));
          nextAttempt.current = performance.now() + delay;
          timer = window.setTimeout(poll, delay);
        }
      }
    };
    timer = window.setTimeout(poll, Math.max(0, nextAttempt.current - performance.now()));
    return () => { cancelled = true; window.clearTimeout(timer); controller?.abort(); };
  }, [active, endpoint]);

  useEffect(() => {
    setSnapshot(null);
    setError(false);
    nextAttempt.current = 0;
  }, [endpoint]);

  return { snapshot, now, loading, error, online, active };
}
