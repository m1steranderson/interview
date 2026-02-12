import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index.js";
import  { CACHE_NAME } from "../index.js";

import { CORELATION_ID_HEADER }  from "@task-manager/shared";

/**
 * CF Cache API middleware.
 * Caches GET responses for SSR pages (not /api/*).
 *
 * Flow:
 *   1. cache.match(request) → HIT → return cached response
 *   2. MISS → await next() → cache.put(request, response.clone())
 *
 * Invalidation happens externally:
 *   Microservice calls CF Purge API after KV writes.
 */
export const cacheMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  // Skip non-app routes
  if (c.req.path.startsWith("/api") || c.req.path.startsWith("/.well-known")) {
    return next();
  }

  const cache = await caches.open(CACHE_NAME);
  
  const cacheKey = new Request(c.req.url, { method: "GET" });

  const cid = c.get(CORELATION_ID_HEADER);

  // Try cache first
  const cached = await cache.match(cacheKey);
  if (cached) {
    console.log(`[${cid}] Cache HIT ${c.req.path}`);
    const response = new Response(cached.body, cached);
    response.headers.set(CORELATION_ID_HEADER, cid);
    response.headers.set("X-Cache", "HIT");
    return response;
  }

  console.log(`[${cid}] Cache MISS ${c.req.path}`);

  // Cache miss — render
  await next();

  // Cache the response for future requests
  const response = c.res.clone();
  response.headers.set("X-Cache", "MISS");

  // Only cache successful responses
  if (response.status === 200) {
    console.log(`[${cid}] Cache PUT ${c.req.path}`);
    c.executionCtx.waitUntil(cache.put(cacheKey, response));
  }
};
