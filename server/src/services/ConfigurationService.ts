import { jsonStore } from '../storage/jsonStore';
import type { AppSettings } from '../types';

/** Reads and writes the General / Advanced application settings. */
export const ConfigurationService = {
  getSettings(): AppSettings {
    return jsonStore.read().settings;
  },

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    return jsonStore.update((store) => {
      store.settings = {
        general: { ...store.settings.general, ...partial.general },
        advanced: { ...store.settings.advanced, ...partial.advanced },
        defaultGatewayId: partial.defaultGatewayId ?? store.settings.defaultGatewayId,
      };
      return store.settings;
    });
  },
};
