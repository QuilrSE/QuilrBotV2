import { apiDelete, apiGet, apiPost } from './api';
import type { SavedGatewayProfile } from '../types';

/** Thin client-side wrapper matching the server's GatewayService surface. */
export const GatewayService = {
  list(): Promise<{ gateways: SavedGatewayProfile[] }> {
    return apiGet('/gateways');
  },
  save(gateway: Record<string, unknown>): Promise<{ gateway: SavedGatewayProfile }> {
    return apiPost('/gateways', gateway);
  },
  remove(id: string): Promise<{ deleted: boolean }> {
    return apiDelete(`/gateways/${id}`);
  },
  reveal(id: string): Promise<{ gateway: SavedGatewayProfile & { apiKey: string } }> {
    return apiGet(`/gateways/${id}/reveal`);
  },
};
