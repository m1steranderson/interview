import type { FC } from "hono/jsx";
import type { Task } from "@task-manager/shared";

const statusBadge: Record<Task["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
};

export const TaskList: FC<{ tasks: Task[] }> = ({ tasks }) => {
  if (tasks.length === 0) {
    return (
      <div class="text-center py-12 text-gray-500">
        <p class="text-lg">No tasks yet</p>
        <p class="text-sm mt-1">
          Publish an event to <code>tasks.created</code> via NATS to add one.
        </p>
      </div>
    );
  }

  return (
    <ul class="space-y-3">
      {tasks.map((task) => (
        <li key={task.id} class="rounded-lg mb-2">
          <a
            href={`/tasks/${task.id}`}
            class="block bg-white rounded-lg border border-gray-200 px-5 py-4 hover:border-blue-300 transition-colors"
          >
            <div class="flex items-center justify-between">
              <h2 class="font-medium">{task.title}</h2>
              <span
                class={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadge[task.status]}`}
              >
                {task.status}
              </span>
            </div>
            {task.description && (
              <p class="text-sm text-gray-500 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
};
