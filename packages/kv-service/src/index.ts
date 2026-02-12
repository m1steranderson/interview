import { WorkerEntrypoint } from "cloudflare:workers";
import type { Task } from "@task-manager/shared";
import { CORELATION_ID_HEADER, KV_PREFIX, verifyHmac } from "@task-manager/shared";

// ─── Env ─────────────────────────────────────────────
interface Env {
  TASKS_KV: KVNamespace;
  KV_SECRET: string;
}

// ─── RPC Interface (Service Binding — only access point) ──
/**
 * Internal-only service.
 * Accessible exclusively via Service Binding from Web Worker.
 *
 * Usage in Web Worker:
 *   const task = await c.env.KV_SERVICE.getTask(id, correlationId);
 *   const tasks = await c.env.KV_SERVICE.listTasks(offset, limit, correlationId);
 *
 * wrangler.toml (web):
 *   [[services]]
 *   binding = "KV_SERVICE"
 *   service = "task-manager-kv-service"
 *   entrypoint = "TaskService"
 */
export interface ListTasksResult {
  tasks: Task[];
  total: number;
  offset: number;
  limit: number;
}

// ─── Core KV operations ──────────────────────────────
async function getTask(kv: KVNamespace, id: string): Promise<Task | null> {
  return kv.get<Task>(`${KV_PREFIX}${id}`, "json");
}

async function listTasks(kv: KVNamespace, offset = 0, limit = 50): Promise<ListTasksResult> {
  const { keys } = await kv.list({ prefix: KV_PREFIX });

  const allTasks = await Promise.all(
    keys.map((key) => kv.get<Task>(key.name, "json")),
  );

  const filtered = allTasks.filter((t): t is Task => t !== null);
  const total = filtered.length;
  const tasks = filtered.slice(offset, offset + limit);

  return { tasks, total, offset, limit };
}

// ─── RPC (Service Binding) ───────────────────────────
export class TaskService extends WorkerEntrypoint<Env> {
  async getTask(id: string, correlationId?: string): Promise<Task | null> {
    const cid = correlationId ?? "—";
    const task = await getTask(this.env.TASKS_KV, id);
    console.log(`[${cid}] RPC getTask(${id}) → ${task ? "found" : "not found"}`);
    return task;
  }

  async listTasks(offset = 0, limit = 50, correlationId?: string): Promise<ListTasksResult> {
    const cid = correlationId ?? "—";
    const result = await listTasks(this.env.TASKS_KV, offset, limit);
    console.log(`[${cid}] RPC listTasks(${offset}, ${limit}) → ${result.total} tasks`);
    return result;
  }
}

// ─── HTTP GET endpoints (HMAC-protected) ─────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET") {
      return Response.json({ error: "Method Not Allowed" }, { status: 405 });
    }

    const correlationId = request.headers.get(CORELATION_ID_HEADER) ?? "—";

    // ── HMAC auth ────────────────────────────────────
    const token = url.searchParams.get("token");
    const ts = url.searchParams.get("ts");

    if (!token || !ts) {
      console.log(`[${correlationId}] ${request.method} ${url.pathname} → 403 (missing auth)`);
      return Response.json({ error: "Missing auth params" }, { status: 403 });
    }

    const { valid, error } = await verifyHmac(url.pathname, token, ts, env.KV_SECRET);
    if (!valid) {
      console.log(`[${correlationId}] ${request.method} ${url.pathname} → 403 (${error})`);
      return Response.json({ error }, { status: 403 });
    }

    // ── GET /tasks/:id ───────────────────────────────
    const match = url.pathname.match(/^\/tasks\/([^/]+)$/);
    if (match) {
      const task = await getTask(env.TASKS_KV, match[1]);
      if (!task) {
        console.log(`[${correlationId}] GET /tasks/${match[1]} → 404`);
        return Response.json({ error: "Not Found" }, { status: 404 });
      }
      console.log(`[${correlationId}] GET /tasks/${match[1]} → 200`);
      return Response.json(task);
    }

    // ── GET /tasks?offset=0&limit=50 ─────────────────
    if (url.pathname === "/tasks") {
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

      const result = await listTasks(env.TASKS_KV, offset, limit);
      console.log(`[${correlationId}] GET /tasks → 200 (${result.total} tasks)`);
      return Response.json(result);
    }

    console.log(`[${correlationId}] ${request.method} ${url.pathname} → 404`);
    return Response.json({ error: "Not Found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
