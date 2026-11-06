import { apiGet, apiPut } from './api';
import type { AppSettings } from '../types';

/** Thin client-side wrapper matching the server's ConfigurationService surface. */
export const ConfigurationService = {
  get(): Promise<{ settings: AppSettings }> {
    return apiGet('/settings');
  },
  update(partial: Partial<AppSettings>): Promise<{ settings: AppSettings }> {
    return apiPut('/settings', partial);
  },
};
