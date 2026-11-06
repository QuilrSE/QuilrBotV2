import { Router } from 'express';
import { GatewayService } from '../services/GatewayService';

export const gatewaysRouter = Router();

gatewaysRouter.get('/', (_req, res) => {
  res.json({ gateways: GatewayService.listSavedProfiles() });
});

gatewaysRouter.post('/', (req, res, next) => {
  try {
    const gateway = GatewayService.saveProfile(req.body);
    const { apiKey, ...safe } = gateway;
    res.status(201).json({ gateway: { ...safe, hasApiKey: Boolean(apiKey) } });
  } catch (error) {
    next(error);
  }
});

gatewaysRouter.delete('/:id', (req, res) => {
  const deleted = GatewayService.deleteProfile(req.params.id);
  res.status(deleted ? 200 : 404).json({ deleted });
});

gatewaysRouter.get('/:id/reveal', (req, res) => {
  const gateway = GatewayService.getSavedProfileWithSecret(req.params.id);
  if (!gateway) {
    res.status(404).json({ error: { message: 'Gateway profile not found.' } });
    return;
  }
  res.json({ gateway });
});
