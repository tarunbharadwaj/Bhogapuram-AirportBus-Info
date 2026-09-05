import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const page = (path) => resolve(process.cwd(), path, 'index.html');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        bhogapuramAirportBus: page('bhogapuram-airport-bus'),
        vizagAirportBusTimings: page('vizag-airport-bus-timings'),
        bhogapuramAirportBusRoutes: page('bhogapuram-airport-bus-routes'),
        bhogapuramAirportBusFares: page('bhogapuram-airport-bus-fares'),
        vizagAirportBusStops: page('vizag-airport-bus-stops'),
        asr1: page('routes/asr-1'),
        asr2: page('routes/asr-2'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
});
