import { Router } from 'express';

export function createTrackingRoutes(controller) {
  const router = Router();
  // No arbitrary URLs, document IDs or dates accepted from clients.
  router.get('/live-buses', controller.getLiveBuses);
  router.get('/stop-tracking', controller.getStopTracking);
  return router;
}
