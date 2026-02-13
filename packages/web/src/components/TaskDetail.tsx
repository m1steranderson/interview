import type { FC } from "react";
import type { Task } from "@task-manager/shared";

const statusBadge: Record<Task["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
};

export const TaskDetail: FC<{ task: Task }> = ({ task }) => (
  <article className="bg-white rounded-lg border border-gray-200 p-6">
    <div className="flex items-start justify-between mb-4">
      <h1 className="text-2xl font-bold">{task.title}</h1>
      <span
        className={`text-sm font-medium px-3 py-1 rounded-full ${statusBadge[task.status]}`}
      >
        {task.status}
      </span>
    </div>

    {task.description && (
      <p className="text-gray-600 mb-6">{task.description}</p>
    )}

    <dl className="grid grid-cols-2 gap-4 text-sm text-gray-500 border-t border-gray-100 pt-4">
      <div>
        <dt className="font-medium text-gray-700">ID</dt>
        <dd className="font-mono text-xs mt-0.5">{task.id}</dd>
      </div>
      <div>
        <dt className="font-medium text-gray-700">Created</dt>
        <dd className="mt-0.5">{new Date(task.createdAt).toLocaleString()}</dd>
      </div>
      <div>
        <dt className="font-medium text-gray-700">Updated</dt>
        <dd className="mt-0.5">{new Date(task.updatedAt).toLocaleString()}</dd>
      </div>
    </dl>

    <div className="mt-6">
      <a href="/" className="text-blue-600 hover:text-blue-800 text-sm">
        &larr; Back to list
      </a>
    </div>
  </article>
);
