export const CORELATION_ID_HEADER = "X-Correlation-Id";

export const TASK_STATUSES = ["pending", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** KV key format: task:{uuid} */
export const kvKey = (id: string) => `task:${id}` as const;
export const KV_PREFIX = "task:" as const;

/** Infra field, not part of domain */
interface WithCorrelation  {
  correlationId: string;
};

/** Payloads for sources[NATS|HTTP] messages — derived from Task */
export type TaskCreatedPayload = Omit<Task, "createdAt" | "updatedAt" | "status"> & {
  status?: TaskStatus;
} & WithCorrelation;

export type TaskUpdatedPayload = Pick<Task, "id"> &
  Partial<Pick<Task, "title" | "description" | "status">> &
  WithCorrelation;

export type TaskDeletedPayload = Pick<Task, "id"> & WithCorrelation;

