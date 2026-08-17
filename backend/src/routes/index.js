import { Router } from 'express';
import { createAdminRoutes } from './adminRoutes.js';
import { createServiceRoutes } from './serviceRoutes.js';

export const createApiRoutes = ({ serviceController, adminController, sessions }) => {
  const router = Router();
  router.use(createServiceRoutes(serviceController));
  router.use('/admin', createAdminRoutes(adminController, sessions));
  return router;
};
