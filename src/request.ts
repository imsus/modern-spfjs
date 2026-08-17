/**
 * The request/protocol layer: URL identifier, headers, single-JSON parsing,
 * and NDJSON streaming with per-part events.
 */

import { config } from './config';
import { event } from './events';
import type { RequestOptions, SingleResponse, SpfRequestType, StreamPart } from './types';

const ACCEPT = 'application/x-spf+json, application/x-spf+ndjson;q=0.9';

/** Appends the SPF URL identifier to a URL. */
export function buildRequestUrl(url: string, type: SpfRequestType = 'navigate'): string {
  const marker = config.get('url-identifier').replace('__type__', type);
  if (!marker) return url;
  if (marker.startsWith('?')) {
    const sep = url.includes('?') ? '&' : '?';
    return url + sep + marker.slice(1);
  }
  return url + marker;
}

/** Builds the request headers (config → options → SPF identification wins). */
export function buildHeaders(options: RequestOptions, type: SpfRequestType = 'navigate') {
  const headers = new Headers({ Accept: ACCEPT });
  const configHeaders = config.get('request-headers');
  if (configHeaders) {
    for (const [key, value] of Object.entries(configHeaders)) headers.set(key, value);
  }
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) headers.set(key, value);
  }
  const headerId = config.get('advanced-header-identifier');
  if (headerId) {
    headers.set('X-SPF-Request', headerId.replace('__type__', type));
    headers.set('Accept', 'application/json');
  }
  if (options.referer != null) headers.set('X-SPF-Referer', options.referer);
  if (options.current != null) headers.set('X-SPF-Previous', options.current);
  return headers;
}

/** Fetches and parses an SPF response (single JSON or NDJSON stream). */
export async function fetchResponse(
  url: string,
  options: RequestOptions = {},
  type: SpfRequestType = 'navigate',
): Promise<SingleResponse> {
  const requestUrl = buildRequestUrl(url, type);
  const headers = buildHeaders(options, type);
  const timeout = config.get('request-timeout');
  const controller = new AbortController();
  const timer = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    const res = await fetch(requestUrl, {
      method: options.method ?? 'GET',
      headers,
      body: options.method === 'POST' ? options.postData : undefined,
      credentials: options.withCredentials ? 'include' : 'same-origin',
      signal: controller.signal,
      redirect: 'manual',
    });
    if (!res.ok) {
      throw new Error(`SPF request failed: ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-spf+ndjson') && res.body) {
      return await parseStream(res.body, options);
    }
    // SAFETY: the SPF server contract (spec/PROTOCOL.md) guarantees a SingleResponse JSON body.
    return (await res.json()) as SingleResponse;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Parses an NDJSON stream of parts, aggregating into one response. */
export async function parseStream(
  body: ReadableStream<Uint8Array>,
  options: RequestOptions = {},
): Promise<SingleResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const aggregated: SingleResponse = {};
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf('\n');
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        // SAFETY: each NDJSON line is a StreamPart per the SPF protocol.
        const part = JSON.parse(line) as StreamPart;
        await handlePart(part, aggregated, options);
      }
      nl = buffer.indexOf('\n');
    }
  }
  return aggregated;
}

async function handlePart(
  part: StreamPart,
  aggregated: SingleResponse,
  options: RequestOptions,
): Promise<void> {
  const detail = { part, response: aggregated };
  if (!(await event.emit('spfpartprocess', detail))) return;
  switch (part.part) {
    case 'title':
      aggregated.title = part.value;
      break;
    case 'url':
      aggregated.url = part.value;
      break;
    case 'head':
      aggregated.head = (aggregated.head ?? '') + part.html;
      break;
    case 'attr':
      aggregated.attr = { ...aggregated.attr, [part.id]: part.attrs };
      break;
    case 'body':
      aggregated.body = { ...aggregated.body, [part.id]: part.html };
      break;
    case 'foot':
      aggregated.foot = (aggregated.foot ?? '') + part.html;
      break;
    case 'done':
      break;
  }
  await options.onPartDone?.(detail);
  await event.emit('spfpartdone', detail);
}
