import { describe, expect, it } from 'vitest';
import { config } from '../config';
import { buildHeaders, buildRequestUrl, parseStream } from '../request';
import type { SingleResponse } from '../types';

describe('buildRequestUrl', () => {
  it('appends the default navigate identifier', () => {
    config.clear();
    expect(buildRequestUrl('https://example.com/dest', 'navigate')).toBe(
      'https://example.com/dest?spf=navigate',
    );
  });

  it('appends prefetch and load types', () => {
    config.clear();
    expect(buildRequestUrl('https://example.com/dest', 'prefetch')).toBe(
      'https://example.com/dest?spf=prefetch',
    );
    expect(buildRequestUrl('https://example.com/dest', 'load')).toBe(
      'https://example.com/dest?spf=load',
    );
  });

  it('preserves an existing query string', () => {
    config.clear();
    expect(buildRequestUrl('https://example.com/dest?a=1', 'navigate')).toBe(
      'https://example.com/dest?a=1&spf=navigate',
    );
  });

  it('honors a custom url-identifier', () => {
    config.init({ 'url-identifier': '?spf=__type__' });
    expect(buildRequestUrl('https://example.com/', 'navigate')).toBe(
      'https://example.com/?spf=navigate',
    );
  });
});

describe('buildHeaders', () => {
  it('sends the SPF accept header by default', () => {
    config.clear();
    const headers = buildHeaders({});
    expect(headers['Accept']).toBe('application/x-spf+json, application/x-spf+ndjson;q=0.9');
  });

  it('sends referer/previous when provided', () => {
    config.clear();
    const headers = buildHeaders({ referer: '/a', current: '/b' });
    expect(headers['X-SPF-Referer']).toBe('/a');
    expect(headers['X-SPF-Previous']).toBe('/b');
  });

  it('uses the header identifier when configured', () => {
    // SPF semantics: the header NAME is fixed (X-SPF-Request); the config
    // value is the value template with __type__ replaced by the request type.
    config.init({ 'advanced-header-identifier': '__type__' });
    const headers = buildHeaders({}, 'navigate');
    expect(headers['X-SPF-Request']).toBe('navigate');
    expect(headers['Accept']).toBe('application/json');
    config.clear();
  });
});

describe('parseStream', () => {
  function streamOf(lines: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const body = lines.map((l) => encoder.encode(l + '\n'));
    return new ReadableStream({
      start(controller) {
        for (const chunk of body) controller.enqueue(chunk);
        controller.close();
      },
    });
  }

  it('aggregates parts into a single response in order', async () => {
    const response = await parseStream(
      streamOf([
        '{"part":"title","value":"Page Title"}',
        '{"part":"head","html":"<style>a{}</style>"}',
        '{"part":"body","id":"content","html":"<p>Hi</p>"}',
        '{"part":"attr","id":"content","attrs":{"class":"wide"}}',
        '{"part":"foot","html":"<script>1</script>"}',
        '{"part":"done"}',
      ]),
    );
    expect(response).toEqual({
      title: 'Page Title',
      head: '<style>a{}</style>',
      body: { content: '<p>Hi</p>' },
      attr: { content: { class: 'wide' } },
      foot: '<script>1</script>',
    } satisfies SingleResponse);
  });

  it('concatenates repeated head/foot parts', async () => {
    const response = await parseStream(
      streamOf([
        '{"part":"head","html":"<style>a{}</style>"}',
        '{"part":"head","html":"<link rel=stylesheet>"}',
      ]),
    );
    expect(response.head).toBe('<style>a{}</style><link rel=stylesheet>');
  });

  it('handles chunks split across arbitrary boundaries', async () => {
    const encoder = new TextEncoder();
    const all = encoder.encode('{"part":"title","value":"T"}\n{"part":"done"}\n');
    const half = Math.floor(all.length / 2);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(all.slice(0, half));
        controller.enqueue(all.slice(half));
        controller.close();
      },
    });
    const response = await parseStream(stream);
    expect(response.title).toBe('T');
  });
});
