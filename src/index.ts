/**
 * modern-spf public surface.
 *
 * Concept-compatible with SPF: `spf.init/navigate/load/process/prefetch`,
 * `spf.cache`, `spf.script`, `spf.style`, `spf.config`, `spf.event`, and the
 * `spf*` event names — with modern semantics (Promise-aware, typed).
 */

import { applyResponse } from './apply';
import { cache } from './cache';
import { config } from './config';
import type { SpfConfig } from './config';
import { event } from './events';
import * as nav from './nav';
import { script } from './script';
import { style } from './style';
import type { SingleResponse } from './types';

export const version = '0.0.1';

/** Initializes SPF. Returns false if the Navigation API is unavailable. */
export function init(optConfig?: Partial<SpfConfig>): boolean {
  config.init(optConfig);
  return nav.init();
}

/** Disposes SPF. */
export function dispose(): void {
  nav.dispose();
}

/** Navigates to a URL via SPF; resolves when the pipeline settles. */
export function navigate(url: string, options?: Parameters<typeof nav.navigate>[1]): Promise<void> {
  return nav.navigate(url, options);
}

/** Loads a URL without navigation; returns the applied response. */
export function load(
  url: string,
  options?: Parameters<typeof nav.load>[1],
): Promise<SingleResponse> {
  return nav.load(url, options);
}

/** Processes a response on the current page outside a navigation flow. */
export async function process(response: SingleResponse): Promise<void> {
  await applyResponse(response);
}

/** Prefetches a URL into the cache (aborted → undefined). */
export function prefetch(
  url: string,
  options?: Parameters<typeof nav.prefetch>[1],
): Promise<SingleResponse | undefined> {
  return nav.prefetch(url, options);
}

/** The `spf` namespace object (also the IIFE global). */
export const spf = {
  init,
  dispose,
  navigate,
  load,
  process,
  prefetch,
  cache,
  script,
  style,
  config,
  event,
  version,
};

export { cache, script, style, config, event };
export type * from './types';
