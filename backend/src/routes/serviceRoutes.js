import { Router } from 'express';

export const createServiceRoutes = (controller) => {
  const router = Router();
  router.get('/health', controller.health);
  router.get('/service', controller.getService);
  router.get('/nearest', controller.getNearest);
  router.post('/recommendations', controller.createRecommendation);
  router.get('/timetable', controller.getTimetable);
  return router;
};
