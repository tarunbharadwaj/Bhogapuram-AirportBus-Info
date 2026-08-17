import { Router } from 'express';
import { createRequireAdmin } from '../middleware/requireAdmin.js';

export const createAdminRoutes = (controller, sessions) => {
  const router = Router();
  router.post('/login', controller.login);
  router.put('/service', createRequireAdmin(sessions), controller.updateService);
  return router;
};
