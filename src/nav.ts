/**
 * Navigation layer: link delegation + Navigation API interception.
 *
 * Flow: a click on an `.spf-link` (or `spf.navigate`) sets a pending intent
 * and calls `window.navigation.navigate(url, { state: { spf: true } })`; the
 * `navigate` event listener sees the matching destination, intercepts it, and
 * runs the SPF pipeline: spfrequest → (cache) → fetch → spfprocess → apply →
 * spfdone. Back/forward (traverse) navigations to one of our entries are
 * restored from cache (durable tier first for history). Failures fall back to
 * a full browser navigation.
 */

import { applyResponse } from './apply';
import { cache } from './cache';
import { config } from './config';
import { event } from './events';
import { fetchResponse } from './request';
import { script } from './script';
import { style } from './style';
import type { RequestOptions, SingleResponse, SpfEventDetail, SpfNavigationType } from './types';

interface PendingIntent {
  url: string;
  options: RequestOptions;
  transition: boolean;
  /** Resolves the Promise returned by spf.navigate() when the pipeline settles. */
  resolve: (() => void) | null;
}

let initialized = false;
let pending: PendingIntent | null = null;
let viewportObserver: IntersectionObserver | null = null;
let speculationScript: HTMLScriptElement | null = null;

/** History-entry marker used to recognize our own navigations on back/forward. */
const SPF_STATE = { spf: true };

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
  // SAFETY: click events originate from DOM elements; the target may be null.
  const target = evt.target as Element | null;
  const link = findSpfLink(target);
  if (!link) return;
  const url = normalize(getHref(link));
  if (!sameOrigin(url)) return;
  if (!event.emitSync('spfclick', { url, target })) {
    return; // cancelled: let the browser navigate normally
  }
  evt.preventDefault();
  pending = {
    url,
    options: {},
    transition: !link.classList.contains('spf-no-transition'),
    resolve: null,
  };
  window.navigation.navigate(url, { history: 'push', state: SPF_STATE });
}

/** Intercepts a navigation and restores scroll when the handler completes. */
function interceptNavigation(evt: NavigateEvent, run: () => Promise<void>): void {
  evt.intercept({
    handler: async () => {
      await run();
      evt.scroll?.();
    },
  });
}

function handleNavigate(evt: NavigateEvent): void {
  const url = evt.destination.url;
  if (!sameOrigin(url)) return;
  if (evt.navigationType === 'traverse') {
    handleTraverse(evt, url);
    return;
  }
  const intent = pending;
  pending = null;
  if (!intent || intent.url !== url) return; // not an SPF navigation
  interceptNavigation(evt, async () => {
    await runPipeline(url, intent.options, intent.transition, 'new');
    intent.resolve?.();
  });
}

function handleTraverse(evt: NavigateEvent, url: string): void {
  const state = evt.destination.getState?.();
  if (!state?.spf) {
    // Not one of ours. A same-document destination never reloads on its own:
    // SPF replaced the DOM, so back/forward would rewind the URL and leave
    // stale content showing. Force a full load through the standard fallback
    // (spfreload + location.assign). Cross-document destinations load the
    // real page themselves — leave those to the browser.
    if (evt.destination.sameDocument) {
      evt.preventDefault();
      fallback(url, { url });
    }
    return;
  }
  if (!event.emitSync('spfhistory', { url, previous: location.href })) return;
  interceptNavigation(evt, () => runPipeline(url, {}, true, 'history'));
}

async function runPipeline(
  url: string,
  options: RequestOptions,
  transition: boolean,
  navType: SpfNavigationType,
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
    let response: SingleResponse | null = cache.get(url, navType);
    if (!response) response = await cache.durableGet(url, navType);
    if (!response) {
      response = await fetchResponse(
        url,
        {
          ...options,
          referer: options.referer ?? location.href,
          current: options.current ?? location.href,
        },
        'navigate',
      );
      cache.set(url, response, navType);
      cache.persistent
        .put(url, response)
        .catch((err) => console.warn('modern-spf: failed to persist response', err));
    } else {
      cache.set(url, response, navType); // promote durable hit into memory
    }
    if (response.reload) {
      // PROTOCOL: reload:true → fall back to a full navigation + spferror.
      await event.emit('spferror', { ...detail });
      fallback(url, detail);
      return;
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
    const transitioned = await applyWithTransition(response, transition);
    refreshLinks(); // new page content: observe links + refresh speculation rules
    await event.emit('spfdone', { ...detail, response, transitioned });
    await options.onDone?.({ ...detail, response });
  } catch (err) {
    const errorDetail: SpfEventDetail = {
      ...detail,
      err: err instanceof Error ? err : new Error(String(err)),
    };
    await event.emit('spferror', errorDetail);
    await options.onError?.(errorDetail);
    fallback(url, detail);
  }
}

/**
 * Applies a response, wrapping only the DOM update in a view transition.
 * The network fetch happens *outside* the transition so the page stays live
 * during the wait (wrapping the fetch would freeze the old snapshot).
 * Returns whether a transition actually ran.
 */
async function applyWithTransition(
  response: SingleResponse,
  transition: boolean,
): Promise<boolean> {
  // `instanceof Function` — not typeof — because some environments declare
  // these globals as present-but-undefined stubs (feature detection must
  // verify callability, not existence).
  const reduced =
    matchMedia instanceof Function && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (transition && !reduced && document.startViewTransition instanceof Function) {
    await document.startViewTransition(async () => applyResponse(response)).finished;
    return true;
  }
  await applyResponse(response);
  return false;
}

/** Falls back to a full browser navigation (SPF "Reload" semantics). */
function fallback(url: string, detail: SpfEventDetail): void {
  const reason = config.get('reload-identifier');
  const target = reason ? `${url}${url.includes('?') ? '&' : '?'}${reason}` : url;
  detail.url = target;
  event.emitSync('spfreload', detail);
  location.assign(target);
}

/** Initializes SPF: wires the Navigation API, click delegation, prefetching. */
export function init(): boolean {
  if (initialized) return true;
  const navigation = window.navigation;
  if (!navigation) {
    console.warn(
      'modern-spf: Navigation API not supported in this browser; falling back to full page loads.',
    );
    return false;
  }
  initialized = true;
  navigation.addEventListener('navigate', handleNavigate);
  document.addEventListener('click', handleClick);
  if (config.get('prefetch-viewport') && 'IntersectionObserver' in window) {
    viewportObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // SAFETY: the observer only observes anchors (refreshLinks observes a.spf-link).
            const link = entry.target as HTMLAnchorElement;
            void prefetch(link.href);
            viewportObserver?.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '200px' },
    );
  }
  refreshLinks();
  event.emitSync('spfready', {});
  return true;
}

/** Observes spf-links for viewport prefetch and (re)injects speculation rules. */
function refreshLinks(): void {
  const linkClass = config.get('link-class');
  for (const link of document.querySelectorAll<HTMLAnchorElement>(`a.${linkClass}`)) {
    if (link.href && sameOrigin(link.href) && viewportObserver) {
      viewportObserver.observe(link);
    }
  }
  injectSpeculationRules();
}

/**
 * Injects a speculation-rules script (prefetch/prerender) for same-origin
 * spf-links. Chrome/Edge only; other browsers ignore the script type.
 */
function injectSpeculationRules(): void {
  if (!('supports' in HTMLScriptElement) || !HTMLScriptElement.supports('speculationrules')) {
    return;
  }
  const mode = config.get('speculation');
  if (mode === 'none') return;
  const linkClass = config.get('link-class');
  const urls = [...document.querySelectorAll<HTMLAnchorElement>(`a.${linkClass}`)]
    .map((a) => a.href)
    .filter((u) => u && sameOrigin(u));
  if (!urls.length) return;
  const script = document.createElement('script');
  script.type = 'speculationrules';
  script.textContent = JSON.stringify({ [mode]: [{ source: 'list', urls }] });
  speculationScript?.remove();
  speculationScript = script;
  document.head.appendChild(script);
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
  speculationScript?.remove();
  speculationScript = null;
}

/**
 * Navigates to a URL via SPF (pushState entry; single in-flight request).
 * Resolves when the navigation pipeline settles (success or fallback).
 */
export function navigate(url: string, options: RequestOptions = {}): Promise<void> {
  const target = normalize(url);
  if (!window.navigation) {
    location.assign(target);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    pending = { url: target, options, transition: !options.noTransition, resolve };
    window.navigation.navigate(target, { history: 'push', state: SPF_STATE });
  });
}

/** Loads a URL without navigation (content updates; no URL change). */
export async function load(url: string, options: RequestOptions = {}): Promise<SingleResponse> {
  const target = normalize(url);
  const response = await fetchResponse(
    target,
    {
      ...options,
      referer: options.referer ?? location.href,
      current: options.current ?? location.href,
    },
    'load',
  );
  if (response.reload) {
    const detail: SpfEventDetail = { url: target };
    await event.emit('spferror', detail);
    fallback(target, detail);
    return response;
  }
  await event.emit('spfprocess', { url: target, response });
  await applyResponse(response);
  refreshLinks();
  await event.emit('spfdone', { url: target, response });
  return response;
}

/**
 * Prefetches a URL: fetches the response into the cache (prefetch-eligible,
 * i.e. usable by one new navigation) and primes the browser cache for its
 * scripts and stylesheets. Dispatches spfrequest/spfprocess/spfdone.
 */
export async function prefetch(
  url: string,
  options: RequestOptions = {},
): Promise<SingleResponse | undefined> {
  const target = normalize(url);
  const detail: SpfEventDetail = { url: target };
  if (!(await event.emit('spfrequest', detail))) return undefined; // Abort
  const response = await fetchResponse(target, options, 'prefetch');
  cache.set(target, response, 'prefetch');
  primeResources(response);
  await event.emit('spfprocess', { ...detail, response });
  await event.emit('spfdone', { ...detail, response });
  return response;
}

/** Primes the browser cache for scripts/styles referenced by a response. */
function primeResources(response: SingleResponse): void {
  const html = `${response.head ?? ''}${response.foot ?? ''}`;
  if (!html) return;
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const el of template.content.querySelectorAll('script[src]')) {
    const src = el.getAttribute('src');
    if (src) script.prefetch(src);
  }
  for (const el of template.content.querySelectorAll('link[rel~="stylesheet"][href]')) {
    const href = el.getAttribute('href');
    if (href) style.prefetch(href);
  }
}
