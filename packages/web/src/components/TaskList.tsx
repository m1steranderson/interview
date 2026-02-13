import type { FC } from "react";
import type { Task } from "@task-manager/shared";

const statusBadge: Record<Task["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
};

export const TaskList: FC<{ tasks: Task[] }> = ({ tasks }) => {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No tasks yet</p>
        <p className="text-sm mt-1">
          Publish an event to <code>tasks.created</code> via NATS to add one.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li key={task.id} className="rounded-lg mb-2">
          <a
            href={`/tasks/${task.id}`}
            className="block bg-white rounded-lg border border-gray-200 px-5 py-4 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{task.title}</h2>
              <span
                className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadge[task.status]}`}
              >
                {task.status}
              </span>
            </div>
            {task.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
};
