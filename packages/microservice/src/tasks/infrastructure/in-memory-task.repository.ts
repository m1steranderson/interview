import { Injectable, Logger } from "@nestjs/common";
import { kvKey } from "@task-manager/shared";
import type { Task } from "@task-manager/shared";
import type { ITaskRepository } from "../domain/task.repository";
import { TaskEntity } from "../domain/task.entity";

/**
 * In-memory repository for local development and testing.
 * Data lives only while the process is running.
 *
 * Activated by: USE_IN_MEMORY_KV=true
 */
@Injectable()
export class InMemoryTaskRepository implements ITaskRepository {
  private readonly logger = new Logger(InMemoryTaskRepository.name);
  private readonly store = new Map<string, string>();

  async save(task: TaskEntity, correlationId: string): Promise<boolean> {
    const key = kvKey(task.id);
    const data = task.toPersistence();
    this.store.set(key, JSON.stringify(data));
    this.logger.log(`[${correlationId}] MEM PUT ${key} — OK (store size: ${this.store.size})`);
    return true;
  }

  async findById(id: string, correlationId: string): Promise<TaskEntity | null> {
    const key = kvKey(id);
    const raw = this.store.get(key);

    if (!raw) {
      this.logger.log(`[${correlationId}] MEM GET ${key} — NOT FOUND`);
      return null;
    }

    this.logger.log(`[${correlationId}] MEM GET ${key} — OK`);
    return TaskEntity.fromPersistence(JSON.parse(raw) as Task);
  }

  async delete(id: string, correlationId: string): Promise<boolean> {
    const key = kvKey(id);
    this.store.delete(key);
    this.logger.log(`[${correlationId}] MEM DELETE ${key} — OK (store size: ${this.store.size})`);
    return true;
  }
}
