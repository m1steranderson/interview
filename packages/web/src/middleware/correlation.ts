import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index.js";

import { CORELATION_ID_HEADER }  from "@task-manager/shared";
/**
 * Reads X-Correlation-Id from incoming request.
 * If absent — generates a new one via crypto.randomUUID().
 * Stores in c.set("correlationId") and adds to response headers.
 */
export const correlationMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  const incoming = c.req.header(CORELATION_ID_HEADER);
  const id = incoming ?? crypto.randomUUID();

  c.set(CORELATION_ID_HEADER, id);


  console.log(
    `[${id}] → ${c.req.method} ${c.req.path}${incoming ? "" : " (new cid)"}`,
  );
  
  const start = Date.now();
  await next();
  const ms = Date.now() - start;

  c.header(CORELATION_ID_HEADER, id);

  console.log(`[${id}] ← ${c.res.status} (${ms}ms)`);
  
};
