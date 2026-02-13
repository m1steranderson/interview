import { Hono } from "hono";
import { correlationMiddleware } from "./middleware/correlation.js";
import { cacheMiddleware } from "./middleware/cache.js";
import { pages } from "./routes/pages.js";
import { api } from "./routes/api.js";

/** Import shared Task type for the binding interface */
import type { Task } from "@task-manager/shared";

import { CORELATION_ID_HEADER }  from "@task-manager/shared";


/**
 * Manual interface for the KV_SERVICE binding.
 * Using Service<TaskService> causes "Type instantiation is excessively deep"
 * when combined with Hono's recursive route types.
 */
interface ListTasksResult {
  tasks: Task[];
  total: number;
  offset: number;
  limit: number;
}

interface KVServiceBinding {
  getTask(id: string, correlationId?: string): Promise<Task | null>;
  listTasks(offset?: number, limit?: number, correlationId?: string): Promise<ListTasksResult>;
}
export const CACHE_NAME = 'iv:task-cache';

/** Env types shared across all routes and middleware */
export type AppEnv = {
  Bindings: {
    KV_SERVICE: KVServiceBinding;
    KV_SECRET: string;
  };
  Variables: Record<typeof CORELATION_ID_HEADER, string>;
};

const app = new Hono<AppEnv>();

// --- Middleware (order matters) ---
app.use("*", correlationMiddleware); // 1. Always first
WITH_WEB_CACHE && app.use("*", cacheMiddleware); // 2. Cache SSR pages (skips /api/*)


// --- Routes ---
app.route("/", pages);       // SSR pages: / and /tasks/:id
app.route("/api/", api);      // JSON API: /api/tasks and /api/tasks/:id

// --- Error handling ---
app.onError((err, c) => {
  const cid = c.get(CORELATION_ID_HEADER) ?? "unknown";
  console.error(`[${cid}] Unhandled error:`, err.message);

  if (c.req.path.startsWith("/api")) {
    return c.json({ error: "Internal server error" }, 500);
  }

  return c.html(
    <html>
      <body>
        <h1>500 — Internal Server Error</h1>
        <p>Correlation ID: {cid}</p>
      </body>
    </html>,
    500,
  );
});

app.notFound((c) => {
  const cid = c.get(CORELATION_ID_HEADER) ?? "unknown";
  console.warn(`[${cid}] Not found: ${c.req.method} ${c.req.path}`);

  if (c.req.path.startsWith("/api")) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.html(
    <html>
      <body>
        <h1>404 — Not Found</h1>
        <a href="/">Back to home</a>
      </body>
    </html>,
    404,
  );
});

export default app;
