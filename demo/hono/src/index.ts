/**
 * Entry point: runs the demo with @hono/node-server. The app itself lives in
 * ./app.ts so tests can exercise it without a listening server.
 */

import { serve } from '@hono/node-server';

import { app } from './app.ts';

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`modern-spf hono demo on http://127.0.0.1:${info.port}`);
});
