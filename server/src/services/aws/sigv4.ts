import crypto from 'crypto';

// ============================================================================
// AWS Signature Version 4 — a small, dependency-free signer.
//
// QuilrBot only needs to sign one kind of request (a JSON POST to
// bedrock-runtime), so this deliberately avoids pulling in the AWS SDK. It
// follows https://docs.aws.amazon.com/IAM/latest/UserGuide/create-signed-request.html
// and is verified against AWS's published SigV4 test-suite vectors in
// server/test/sigv4.test.ts.
// ============================================================================

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface SigV4Request {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface SigV4Options {
  service: string;
  region: string;
  credentials: SigV4Credentials;
  /** Injected for tests; defaults to now. */
  now?: Date;
  /** Bedrock accepts it; AWS's generic test vectors omit it. Defaults to true. */
  signContentSha256Header?: boolean;
}

const ALGORITHM = 'AWS4-HMAC-SHA256';

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

/** RFC 3986 encoding: everything except A–Z a–z 0–9 - _ . ~ is percent-encoded. */
export function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

/**
 * Non-S3 services require each path segment to be URI-encoded *twice*. The
 * path we receive from `new URL()` is already encoded once (e.g. a model id's
 * ":" is "%3A"), so encoding each segment again yields the canonical form
 * ("%253A") that Bedrock expects.
 */
function canonicalPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname
    .split('/')
    .map((segment) => uriEncode(segment))
    .join('/');
}

function canonicalQuery(searchParams: URLSearchParams): string {
  const pairs: Array<[string, string]> = [];
  searchParams.forEach((value, key) => pairs.push([uriEncode(key), uriEncode(value)]));
  pairs.sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * Returns a new header map containing everything in `request.headers` plus
 * `host`, `x-amz-date`, `x-amz-content-sha256`, optional
 * `x-amz-security-token`, and `authorization`.
 */
export function signRequest(request: SigV4Request, options: SigV4Options): Record<string, string> {
  const url = new URL(request.url);
  const { amzDate, dateStamp } = toAmzDate(options.now ?? new Date());
  const payloadHash = sha256Hex(request.body);

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers)) {
    headers[name.toLowerCase()] = value;
  }
  delete headers.authorization;
  headers.host = url.host;
  headers['x-amz-date'] = amzDate;
  if (options.signContentSha256Header !== false) {
    headers['x-amz-content-sha256'] = payloadHash;
  }
  if (options.credentials.sessionToken) {
    headers['x-amz-security-token'] = options.credentials.sessionToken;
  }

  const sortedNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedNames
    .map((name) => `${name}:${String(headers[name]).trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const signedHeaders = sortedNames.join(';');

  const canonicalRequest = [
    request.method.toUpperCase(),
    canonicalPath(url.pathname),
    canonicalQuery(url.searchParams),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${options.region}/${options.service}/aws4_request`;
  const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${options.credentials.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, options.region);
  const kService = hmac(kRegion, options.service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return {
    ...headers,
    authorization: `${ALGORITHM} Credential=${options.credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

/** Exposed for tests: the canonical request string, so failures are debuggable. */
export const __internal = { canonicalPath, canonicalQuery, toAmzDate };
