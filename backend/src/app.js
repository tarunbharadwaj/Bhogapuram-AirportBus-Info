import express from 'express';
import { AdminController } from './controllers/adminController.js';
import { ServiceController } from './controllers/serviceController.js';
import { ServiceModel } from './models/serviceModel.js';
import { createApiRoutes } from './routes/index.js';
import { AdminSessionService } from './services/adminSessionService.js';

export const createApp = ({ serviceModel = new ServiceModel(), sessions = new AdminSessionService() } = {}) => {
  const app = express();
  app.use(express.json({ limit: '250kb' }));

  const allowedOrigin = process.env.CLIENT_ORIGIN;
  if (allowedOrigin) {
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      next();
    });
  }

  const serviceController = new ServiceController(serviceModel);
  const adminController = new AdminController(serviceModel, sessions);
  app.use('/api', createApiRoutes({ serviceController, adminController, sessions }));
  return app;
};

export const app = createApp();
