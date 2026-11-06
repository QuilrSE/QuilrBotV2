import { Router } from 'express';
import { ProviderService } from '../services/ProviderService';

export const providersRouter = Router();

/** Read-only catalog of registered direct LLM providers. */
providersRouter.get('/catalog', (_req, res) => {
  res.json({ providers: ProviderService.listDefinitions() });
});

/** Saved provider connection profiles (secrets are never returned). */
providersRouter.get('/saved', (_req, res) => {
  res.json({ profiles: ProviderService.listSavedProfiles() });
});

providersRouter.post('/saved', (req, res, next) => {
  try {
    const profile = ProviderService.saveProfile(req.body);
    res.status(201).json({ profile: ProviderService.toPublic(profile) });
  } catch (error) {
    next(error);
  }
});

providersRouter.delete('/saved/:id', (req, res) => {
  const deleted = ProviderService.deleteProfile(req.params.id);
  res.status(deleted ? 200 : 404).json({ deleted });
});

/** Returns a saved profile *with* its decrypted secret, for populating the composer. */
providersRouter.get('/saved/:id/reveal', (req, res) => {
  const profile = ProviderService.getSavedProfileWithSecret(req.params.id);
  if (!profile) {
    res.status(404).json({ error: { message: 'Provider profile not found.' } });
    return;
  }
  res.json({ profile });
});
