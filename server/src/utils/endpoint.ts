import type { ProviderConnectionConfig, ProviderDefinition } from '../types';
import { joinUrl, normalizeBaseUrl } from './headers';

export class EndpointError extends Error {}

const REGION_PATTERN = /^[a-z]{2}(?:-[a-z]+)+-\d{1,2}$/;
/** Azure's GA dated API, used only for legacy /openai/deployments/... URLs with no version given. */
const AZURE_LEGACY_DEFAULT_VERSION = '2024-10-21';

/**
 * The region is interpolated into a hostname, so it is validated strictly —
 * a crafted value must never be able to point the relay at another host.
 */
export function resolveRegion(definition: ProviderDefinition, requested: string | undefined, fallback: string): string {
  const region = (requested?.trim() || fallback || definition.defaultRegion || '').toLowerCase();
  if (!REGION_PATTERN.test(region)) {
    throw new EndpointError(`"${region || '(empty)'}" is not a valid AWS region, e.g. us-east-1.`);
  }
  return region;
}

function fillTemplate(template: string, values: { region?: string; model: string }): string {
  return template
    .replace(/\{region\}/g, values.region ?? '')
    .replace(/\{model\}/g, encodeURIComponent(values.model));
}

/**
 * Azure OpenAI accepts two shapes:
 *   - Resource endpoint  https://res.openai.azure.com[/openai[/v1]]  → v1 API, no api-version
 *   - Legacy deployment  https://res.openai.azure.com/openai/deployments/<name>[/chat/completions]
 *                        → requires ?api-version=
 */
function resolveAzureUrl(baseUrl: string, chatPath: string, apiVersion?: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const url = new URL(base);

  if (/\/openai\/deployments\//i.test(url.pathname)) {
    const path = /\/chat\/completions$/i.test(url.pathname) ? url.pathname : `${url.pathname}${chatPath}`;
    url.pathname = path;
    url.searchParams.set('api-version', apiVersion?.trim() || AZURE_LEGACY_DEFAULT_VERSION);
    return url.toString();
  }

  let path = url.pathname.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(path)) path = path.replace(/\/chat\/completions$/i, '');
  if (!/\/openai\/v1$/i.test(path)) path = /\/openai$/i.test(path) ? `${path}/v1` : `${path}/openai/v1`;
  url.pathname = `${path}${chatPath}`;
  url.search = '';
  return url.toString();
}

export function resolveProviderUrl(
  definition: ProviderDefinition,
  config: ProviderConnectionConfig,
  options: { stream: boolean; region?: string; serverBaseUrl?: string },
): string {
  const override = definition.allowsBaseUrlOverride ? config.baseUrlOverride?.trim() : '';
  const baseUrl = override || options.serverBaseUrl || definition.defaultBaseUrl;
  if (!baseUrl) throw new EndpointError(`${definition.label} needs a base URL.`);

  if (definition.endpointStyle === 'azure-openai') {
    return resolveAzureUrl(baseUrl, definition.chatPath, config.apiVersion);
  }

  const path = options.stream && definition.streamChatPath ? definition.streamChatPath : definition.chatPath;
  const values = { region: options.region, model: config.model.trim() };
  const resolvedBase = fillTemplate(baseUrl, values);
  return path ? joinUrl(resolvedBase, fillTemplate(path, values)) : normalizeBaseUrl(resolvedBase);
}
