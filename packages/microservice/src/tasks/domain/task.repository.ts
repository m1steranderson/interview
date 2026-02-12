import type { TaskEntity } from "./task.entity";

/** DI token for ITaskRepository */
export const TASK_REPOSITORY = Symbol("TASK_REPOSITORY");

/**
 * Repository interface — domain layer knows nothing about KV / IN MEMORY Storage.
 * Infrastructure provides the concrete implementation (KvTaskRepository).
 */
export interface ITaskRepository {
  save(task: TaskEntity, correlationId: string): Promise<boolean>;
  findById(id: string, correlationId: string): Promise<TaskEntity | null>;
  delete(id: string, correlationId: string): Promise<boolean>;
}
