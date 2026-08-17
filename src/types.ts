/**
 * Public types for modern-spf.
 */

/** A single (non-streamed) SPF response. All fields optional. */
export interface SingleResponse {
  /** New document title. */
  title?: string;
  /** Correct URL for this request; replaces the current history entry. */
  url?: string;
  /** HTML containing early CSS/JS, installed into `<head>`. */
  head?: string;
  /** HTML containing late JS/CSS, installed after body. */
  foot?: string;
  /** Map of element IDs to HTML strings (the fragments). */
  body?: Record<string, string>;
  /** Map of element IDs to attribute name/value maps. */
  attr?: Record<string, Record<string, string>>;
  /** A URL to request instead of this one. */
  redirect?: string;
  /** `true` → perform a full page reload. */
  reload?: boolean;
  /** Cache key the client used/stores for this response. */
  cacheKey?: string;
  /** Cache eligibility hint: `new` | `history` | `prefetch`. */
  cacheType?: string;
  /** Arbitrary server timings, surfaced on `spfdone`. */
  timing?: Record<string, number>;
  /** Reserved for client data. */
  data?: unknown;
}

/** One line of a streamed (NDJSON) SPF response. */
export type StreamPart =
  | { part: 'title'; value: string }
  | { part: 'url'; value: string }
  | { part: 'head'; html: string }
  | { part: 'attr'; id: string; attrs: Record<string, string> }
  | { part: 'body'; id: string; html: string }
  | { part: 'foot'; html: string }
  | { part: 'done' };

/** The kind of SPF request; selects the URL identifier value. */
export type SpfRequestType = 'navigate' | 'prefetch' | 'load';

/** How a navigation was triggered; drives cache eligibility. */
export type SpfNavigationType = 'new' | 'history';

/** Detail object passed to SPF event handlers and request callbacks. */
export interface SpfEventDetail {
  /** The URL of the request. */
  url?: string;
  /** The URL of the previous page (history/request events). */
  previous?: string;
  /** The URL of the previous page (history/request events). */
  referer?: string;
  /** The clicked element (spfclick). */
  target?: Element | null;
  /** The (possibly partial) response (process/done/part events). */
  response?: SingleResponse;
  /** One part of a streamed response (part events). */
  part?: StreamPart;
  /** The error that occurred (spferror). */
  err?: Error;
  /** Whether view transitions were used for this navigation. */
  transitioned?: boolean;
}

/** The canonical SPF event names (concept-compatible with SPF). */
export type SpfEventName =
  | 'spfready'
  | 'spfclick'
  | 'spfhistory'
  | 'spfrequest'
  | 'spfprocess'
  | 'spfdone'
  | 'spferror'
  | 'spfreload'
  | 'spfpartprocess'
  | 'spfpartdone';

/** Event handler; returning `false` cancels the event. May be async. */
export type SpfEventHandler = (detail: SpfEventDetail) => boolean | void | Promise<boolean | void>;

/** Options for requesting a URL. */
export interface RequestOptions {
  /** HTTP method; defaults to `GET`. */
  method?: 'GET' | 'POST';
  /** Extra headers to send. */
  headers?: Record<string, string>;
  /** Body for POST requests. */
  postData?: BodyInit;
  /** Include credentials (cookies) in the request. */
  withCredentials?: boolean;
  /** The referer header value (previous page). */
  referer?: string;
  /** The current URL (previous page). */
  current?: string;
  /** Callback before the request is sent; `false` cancels (fallback: reload). */
  onRequest?: SpfEventHandler;
  /** Callback when a response is received before processing; `false` cancels. */
  onProcess?: SpfEventHandler;
  /** Callback after processing is done. */
  onDone?: SpfEventHandler;
  /** Callback per streamed part before it is applied; `false` skips the part. */
  onPartProcess?: SpfEventHandler;
  /** Callback per streamed part after it is applied. */
  onPartDone?: SpfEventHandler;
  /** Callback on request failure. */
  onError?: SpfEventHandler;
  /** Disable view transitions for this navigation. */
  noTransition?: boolean;
}
