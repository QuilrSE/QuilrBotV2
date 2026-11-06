import { Router } from 'express';
import { ConfigurationService } from '../services/ConfigurationService';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  res.json({ settings: ConfigurationService.getSettings() });
});

settingsRouter.put('/', (req, res, next) => {
  try {
    const settings = ConfigurationService.updateSettings(req.body);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});
