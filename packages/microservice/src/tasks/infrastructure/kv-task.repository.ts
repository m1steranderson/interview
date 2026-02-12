import { Injectable, Logger } from "@nestjs/common";
import Cloudflare from "cloudflare";
import { kvKey } from "@task-manager/shared";
import type { Task } from "@task-manager/shared";
import type { ITaskRepository } from "../domain/task.repository";
import { TaskEntity } from "../domain/task.entity";
import { HTTP_TIMEOUT_MS } from "../../common/params";

/**
 * Concrete repository: persists TaskEntity to Cloudflare KV via SDK.
 *
 * No retry logic — retries are handled by the CQRS Saga.
 * On failure, methods throw; CommandHandler publishes KvWriteFailedEvent.
 */
@Injectable()
export class KvTaskRepository implements ITaskRepository {
  private readonly logger = new Logger(KvTaskRepository.name);
  private readonly cf: Cloudflare;
  private readonly accountId: string;
  private readonly namespaceId: string;

  constructor() {
    const accountId = process.env.CF_ACCOUNT_ID;
    const namespaceId = process.env.CF_NAMESPACE_ID;
    const apiToken = process.env.CF_API_TOKEN;

    if (!accountId || !namespaceId || !apiToken) {
      throw new Error(
        "Missing required env: CF_ACCOUNT_ID, CF_NAMESPACE_ID, CF_API_TOKEN",
      );
    }

    this.accountId = accountId;
    this.namespaceId = namespaceId;
    this.cf = new Cloudflare({ apiToken, timeout: HTTP_TIMEOUT_MS });
  }

  async save(task: TaskEntity, correlationId: string): Promise<boolean> {
    const key = kvKey(task.id);
    const data = task.toPersistence();
    try {
      const response = await this.cf.kv.namespaces.values.update(this.namespaceId, key, {
        account_id: this.accountId,
        value: JSON.stringify(data),
      });

      this.logger.log(`[${correlationId}] KV PUT ${key} — OK (response: ${JSON.stringify(response)})`);
    } catch (error: any) {
      this.logger.log(`[${correlationId}] KV PUT ${key} — FAILED (error: ${JSON.stringify(error)})`);
      return false;
    }

    return true;
  }

  async findById(
    id: string,
    correlationId: string,
  ): Promise<TaskEntity | null> {
    const key = kvKey(id);

    try {
      const response = await this.cf.kv.namespaces.values.get(
        this.namespaceId,
        key,
        { account_id: this.accountId },
      );

      const text = await response.text();
      const data = JSON.parse(text) as Task;

      this.logger.log(`[${correlationId}] KV GET ${key} — OK`);
      return TaskEntity.fromPersistence(data);
    } catch (error: any) {
      if (error?.status === 404) return null;
      throw error;
    }
  }

  async delete(id: string, correlationId: string): Promise<boolean> {
    const key = kvKey(id);

    try {
      const response = await this.cf.kv.namespaces.values.delete(this.namespaceId, key, {
        account_id: this.accountId,
      });

      this.logger.log(`[${correlationId}] KV DELETE ${key} — OK (response: ${JSON.stringify(response)})`);
    } catch (error: any) {
      this.logger.log(`[${correlationId}] KV DELETE ${key} — FAILED (error: ${JSON.stringify(error)})`);
      return false;

    }

    return true;
  }
}
