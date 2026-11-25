import { Router } from 'express';
import { createAdminRoutes } from './adminRoutes.js';
import { createServiceRoutes } from './serviceRoutes.js';

export const createApiRoutes = ({ serviceController, adminController, sessions, tracking, serviceModel }) => {
  const router = Router();
  router.get('/live-buses', async (req, res) => {
    const enabledCodes = new Set(serviceModel.getAll().routes.filter((route) => route.enabled).map((route) => route.code));
    const snapshot = enabledCodes.size
      ? await tracking.getSnapshot({ refresh: req.query.refresh === '1' })
      : { status: 'disabled', feedUpdatedAt: null, buses: [] };
    res.set('Cache-Control', 'no-store').json({
      ...snapshot,
      buses: snapshot.buses.filter((bus) => enabledCodes.has(bus.routeCode))
    });
  });
  router.use(createServiceRoutes(serviceController));
  router.use('/admin', createAdminRoutes(adminController, sessions));
  return router;
};
