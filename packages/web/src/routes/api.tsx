import { Hono } from "hono";

import { CORELATION_ID_HEADER }  from "@task-manager/shared";
import type { AppEnv  } from "../index.js";
import { CACHE_NAME } from "../index.js";
import { verifyHmac } from "@task-manager/shared";

export const api = new Hono<AppEnv>();


/** GET /api/tasks — JSON list with offset/limit */
api.get("/tasks", async (c) => {
  const cid = c.get(CORELATION_ID_HEADER);
  const offset = Math.max(0, +(c.req.query("offset") ?? 0));
  const limit  = Math.min(100, Math.max(1, +(c.req.query("limit") ?? 50)));

  const result = await c.env.KV_SERVICE.listTasks(offset, limit, cid);

  console.log(`[${cid}] GET /api/tasks — ${result.total} total, returning ${result.tasks.length}`);

  return c.json(result);
});

/** GET /api/tasks/:id — JSON single task */
api.get("/tasks/:id", async (c) => {
  const cid = c.get(CORELATION_ID_HEADER);
  const id = c.req.param("id");
  const task = await c.env.KV_SERVICE.getTask(id, cid);

  console.log(`[${cid}] GET /api/tasks/${id} — ${task ? "found" : "not found"}`);

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ task });
});

/**
 * POST /api/cache/purge — Invalidate cached SSR pages.
 * Protected by HMAC-SHA256 signature with 5s TTL.
 *
 * Query: ?token=<hex>&ts=<unix_seconds>
 * Body:  { "taskId": "uuid" }
 *
 * Purges: / (list page) + /tasks/:id (detail page)
 */
api.post("/cache/purge", async (c) => {
  const cid = c.get(CORELATION_ID_HEADER) ?? "unknown";
  const token = c.req.query("token");
  const ts = c.req.query("ts");

  if (!token || !ts) {
    return c.json({ error: "Missing auth params" }, 403);
  }

  const { valid, error } = await verifyHmac(
    c.req.path,
    token,
    ts,
    c.env.KV_SECRET,
  );

  if (!valid) {
    console.warn(`[${cid}] Purge rejected: ${error}`);
    return c.json({ error }, 403);
  }

  const { taskId } = await c.req.json<{ taskId: string }>();
  const origin = new URL(c.req.url).origin;

  const cache = await caches.open(CACHE_NAME);

  const purged: string[] = [];

  // Purge task detail page
  if (taskId) {
    const detailUrl = `${origin}/tasks/${taskId}`;
    await cache.delete(new Request(detailUrl));
    purged.push(detailUrl);
  }

  // Purge list page (always affected)
  const listUrl = `${origin}/`;
  await cache.delete(new Request(listUrl));
  purged.push(listUrl);

  console.log(`[${cid}] Cache purged: ${purged.join(", ")}`);
  return c.json({ purged });
});
