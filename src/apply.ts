/**
 * Applies a parsed SPF response to the current page, in SPF's processing
 * order: title → url → head → attr → body → foot.
 */

import type { SingleResponse } from './types';

export interface ApplyOptions {
  /** Whether scripts in head/foot should block processing (default true). */
  waitForScripts?: boolean;
}

/** Applies a response to the document. Throws on fatal conditions (redirect). */
export async function applyResponse(
  response: SingleResponse,
  options: ApplyOptions = {},
): Promise<void> {
  // Note: `reload: true` is handled by the navigation pipeline (fall back to
  // a full navigation + spferror) before a response reaches apply.
  if (response.redirect) {
    // Handled by the caller (fallback navigation); surface for the pipeline.
    throw new Error(`SPF: response requested redirect to ${response.redirect}`);
  }
  if (response.title) document.title = response.title;
  if (response.url) {
    try {
      history.replaceState(history.state, '', response.url);
    } catch {
      // Same-origin enforcement failed (e.g. cross-origin url) — ignore.
    }
  }
  const wait = options.waitForScripts ?? true;
  if (response.head) await installHtml(response.head, wait);
  if (response.attr) applyAttrs(response.attr);
  if (response.body) applyBody(response.body);
  if (response.foot) await installHtml(response.foot, wait);
}

/** Replaces each fragment element's content by ID. */
export function applyBody(body: Record<string, string>): void {
  for (const [id, html] of Object.entries(body)) {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = html;
    } else {
      console.warn(`SPF: no element with id "${id}" to update`);
    }
  }
}

/** Sets attributes on elements by ID. */
export function applyAttrs(attr: Record<string, Record<string, string>>): void {
  for (const [id, attrs] of Object.entries(attr)) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`SPF: no element with id "${id}" to update attributes`);
      continue;
    }
    for (const [name, value] of Object.entries(attrs)) {
      el.setAttribute(name, value);
    }
  }
}

/** Installs head/foot HTML: scripts execute in order (unless async). */
export async function installHtml(html: string, wait: boolean): Promise<void> {
  const template = document.createElement('template');
  template.innerHTML = html;
  const nodes = [...template.content.childNodes];
  for (const node of nodes) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      // SAFETY: nodeType === ELEMENT_NODE guarantees an element.
      const el = node as HTMLElement;
      if (el.tagName === 'SCRIPT') {
        // SAFETY: tagName === 'SCRIPT' narrows the element to a script element.
        await installScript(el as HTMLScriptElement, wait);
        continue;
      }
      if (el.tagName === 'STYLE' || el.tagName === 'LINK') {
        document.head.appendChild(el);
        continue;
      }
    }
    document.head.appendChild(node);
  }
}

function installScript(source: HTMLScriptElement, wait: boolean): Promise<void> {
  const el = document.createElement('script');
  if (source.src) {
    el.src = source.src;
    if (source.async) el.async = true;
    if (!wait || source.async) {
      document.head.appendChild(el);
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`SPF: failed to load script ${el.src}`));
      document.head.appendChild(el);
    });
  }
  el.text = source.textContent ?? '';
  document.head.appendChild(el);
  return Promise.resolve();
}
