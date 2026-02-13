import { Hono } from "hono";
import type { AppEnv } from "../index.js";
import { renderHtml } from "../index.js";
import { CORELATION_ID_HEADER } from "@task-manager/shared";
import { Layout } from "../components/Layout.js";
import { TaskList } from "../components/TaskList.js";
import { TaskDetail } from "../components/TaskDetail.js";

export const pages = new Hono<AppEnv>();

/** GET / — List all tasks (SSR) */
pages.get("/", async (c) => {
  const cid = c.get(CORELATION_ID_HEADER);
  const { tasks } = await c.env.KV_SERVICE.listTasks(0, 100, cid);

  console.log(`[${cid}] GET / — rendering ${tasks.length} tasks`);

  return c.html(
    renderHtml(
      <Layout title="Tasks">
        <h1 className="text-2xl font-bold mb-6">Tasks</h1>
        <TaskList tasks={tasks} />
      </Layout>,
    ),
  );
});

/** GET /tasks/:id — Task detail (SSR) */
pages.get("/tasks/:id", async (c) => {
  const cid = c.get(CORELATION_ID_HEADER);
  const id = c.req.param("id");
  const task = await c.env.KV_SERVICE.getTask(id, cid);

  console.log(`[${cid}] GET /tasks/${id} — ${task ? "found" : "not found"}`);

  if (!task) {
    return c.html(
      renderHtml(
        <Layout title="Not Found">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-800">Task not found</h1>
            <p className="text-gray-500 mt-2">
              No task with ID <code className="text-sm">{id}</code>
            </p>
            <a href="/" className="text-blue-600 hover:text-blue-800 text-sm mt-4 inline-block">
              &larr; Back to list
            </a>
          </div>
        </Layout>,
      ),
      404,
    );
  }

  return c.html(
    renderHtml(
      <Layout title={task.title}>
        <TaskDetail task={task} />
      </Layout>,
    ),
  );
});
