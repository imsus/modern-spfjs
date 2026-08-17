/**
 * Navigation layer: link delegation + Navigation API interception.
 *
 * Flow: a click on an `.spf-link` (or `spf.navigate`) sets a pending intent
 * and calls `window.navigation.navigate(url)`; the `navigate` event listener
 * sees the matching destination, intercepts it, and runs the SPF pipeline:
 * spfrequest → (cache) → fetch → spfprocess → apply → spfdone. Failures fall
 * back to a full browser navigation.
 */

import { applyResponse } from './apply';
import { cache } from './cache';
import { config } from './config';
import { event } from './events';
import { fetchResponse } from './request';
import type { RequestOptions, SingleResponse, SpfEventDetail } from './types';

interface PendingIntent {
  url: string;
  options: RequestOptions;
  transition: boolean;
}

let initialized = false;
let pending: PendingIntent | null = null;
let viewportObserver: IntersectionObserver | null = null;

/**
 * `transitionWhile` is part of the Navigation API spec but is not present in
 * TS7's generated lib.dom types; augment locally (optional, feature-detected
 * at the call site via `document.startViewTransition`).
 */
declare global {
  interface NavigateEvent {
    transitionWhile?(promise: Promise<unknown>): void;
  }
}

function normalize(url: string): string {
  return new URL(url, location.href).href;
}

function sameOrigin(url: string): boolean {
  try {
    return new URL(url, location.href).origin === location.origin;
  } catch {
    return false;
  }
}

/** Finds the nearest SPF-enabled link for a click target. */
export function findSpfLink(target: Element | null): HTMLAnchorElement | null {
  if (!target || !('closest' in target)) return null;
  const linkClass = config.get('link-class');
  const noLinkClass = config.get('nolink-class');
  const link = target.closest<HTMLAnchorElement>(`a.${linkClass}, form.${linkClass}`);
  if (!link) return null;
  if (link.closest(`.${noLinkClass}`)) return null;
  return link;
}

function getHref(link: HTMLAnchorElement | HTMLFormElement): string {
  if (link instanceof HTMLAnchorElement) return link.href;
  return link.getAttribute('action') ?? location.href;
}

function isIgnorableClick(evt: MouseEvent): boolean {
  return (
    evt.defaultPrevented ||
    evt.button !== 0 ||
    evt.metaKey ||
    evt.ctrlKey ||
    evt.shiftKey ||
    evt.altKey
  );
}

function handleClick(evt: MouseEvent): void {
  if (isIgnorableClick(evt)) return;
  const link = findSpfLink(evt.target as Element | null);
  if (!link) return;
  const url = normalize(getHref(link));
  if (!sameOrigin(url)) return;
  if (!event.emitSync('spfclick', { url, target: evt.target as Element })) {
    return; // cancelled: let the browser navigate normally
  }
  evt.preventDefault();
  pending = {
    url,
    options: {},
    transition: !link.classList.contains('spf-no-transition'),
  };
  window.navigation.navigate(url, { history: 'push' });
}

function handleNavigate(evt: NavigateEvent): void {
  const url = evt.destination.url;
  if (evt.navigationType === 'traverse') {
    // Deepening step: restore from cache (new/history split). For the
    // vertical slice, let the browser handle back/forward natively.
    return;
  }
  if (!sameOrigin(url)) return;
  const intent = pending;
  pending = null;
  if (!intent || intent.url !== url) return; // not an SPF navigation
  const pipeline = () => runPipeline(url, intent.options, intent.transition);
  if (
    intent.transition &&
    typeof document.startViewTransition === 'function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    evt.transitionWhile?.(pipeline());
  } else {
    evt.intercept({ handler: pipeline });
  }
}

async function runPipeline(
  url: string,
  options: RequestOptions,
  transition: boolean,
): Promise<void> {
  const detail: SpfEventDetail = {
    url,
    previous: location.href,
    referer: location.href,
  };
  if (!(await event.emit('spfrequest', detail))) {
    fallback(url, detail);
    return;
  }
  await options.onRequest?.(detail);
  try {
    let response: SingleResponse | null = cache.get(url, 'new');
    if (!response) {
      response = await fetchResponse(url, options, 'navigate');
      cache.set(url, response, 'new');
    }
    if (response.redirect) {
      fallback(response.redirect, detail);
      return;
    }
    const processDetail: SpfEventDetail = { ...detail, response };
    if (!(await event.emit('spfprocess', processDetail))) {
      fallback(url, detail);
      return;
    }
    await options.onProcess?.(processDetail);
    await applyResponse(response);
    await event.emit('spfdone', { ...detail, response, transitioned: transition });
    await options.onDone?.({ ...detail, response });
  } catch (err) {
    const errorDetail: SpfEventDetail = { ...detail, err: err as Error };
    await event.emit('spferror', errorDetail);
    await options.onError?.(errorDetail);
    fallback(url, detail);
  }
}

/** Falls back to a full browser navigation (SPF "Reload" semantics). */
function fallback(url: string, detail: SpfEventDetail): void {
  const reason = config.get('reload-identifier');
  const target = reason ? `${url}${url.includes('?') ? '&' : '?'}${reason}` : url;
  detail.url = target;
  event.emitSync('spfreload', detail);
  location.assign(target);
}

/** Initializes SPF: wires the Navigation API and click delegation. */
export function init(): boolean {
  if (initialized) return true;
  if (!('navigation' in window)) {
    console.warn(
      'modern-spf: Navigation API not supported in this browser; falling back to full page loads.',
    );
    return false;
  }
  initialized = true;
  window.navigation.addEventListener('navigate', handleNavigate);
  document.addEventListener('click', handleClick);
  if (config.get('prefetch-viewport') && 'IntersectionObserver' in window) {
    viewportObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const link = entry.target as HTMLAnchorElement;
            void prefetch(link.href);
            viewportObserver?.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '200px' },
    );
    observeViewportLinks();
  }
  event.emitSync('spfready', {});
  return true;
}

function observeViewportLinks(): void {
  const linkClass = config.get('link-class');
  for (const link of document.querySelectorAll<HTMLAnchorElement>(`a.${linkClass}`)) {
    if (link.href && sameOrigin(link.href)) viewportObserver?.observe(link);
  }
}

/** Disposes SPF: removes listeners and cancels pending state. */
export function dispose(): void {
  if (!initialized) return;
  initialized = false;
  pending = null;
  window.navigation?.removeEventListener('navigate', handleNavigate);
  document.removeEventListener('click', handleClick);
  viewportObserver?.disconnect();
  viewportObserver = null;
}

/** Navigates to a URL via SPF (pushState entry; single in-flight request). */
export function navigate(url: string, options: RequestOptions = {}): void {
  const target = normalize(url);
  if (!('navigation' in window)) {
    location.assign(target);
    return;
  }
  pending = { url: target, options, transition: !options.noTransition };
  window.navigation.navigate(target, { history: 'push' });
}

/** Loads a URL without navigation (content updates; no URL change). */
export async function load(url: string, options: RequestOptions = {}): Promise<SingleResponse> {
  const target = normalize(url);
  const response = await fetchResponse(target, options, 'load');
  await event.emit('spfprocess', { url: target, response });
  await applyResponse(response);
  await event.emit('spfdone', { url: target, response });
  return response;
}

/** Prefetches a URL: fetches the response into the cache (no apply). */
export async function prefetch(url: string, options: RequestOptions = {}): Promise<SingleResponse> {
  const target = normalize(url);
  const response = await fetchResponse(target, options, 'prefetch');
  cache.set(target, response, 'prefetch');
  return response;
}
