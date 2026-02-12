import { Injectable, Logger } from "@nestjs/common";
import { CORELATION_ID_HEADER, signHmac } from "@task-manager/shared";
import type { Task } from "@task-manager/shared";
import { HTTP_TIMEOUT_MS } from "./params";

/**
 * Verifies KV writes by reading back from kv-service HTTP endpoint.
 * Uses HMAC-signed GET requests (same scheme as CachePurgeService).
 */
@Injectable()
export class KvVerifyService {
  private readonly logger = new Logger(KvVerifyService.name);
  private readonly kvServiceUrl: string;
  private readonly secret: string;

  constructor() {
    this.kvServiceUrl =
      process.env.KV_SERVICE_URL ?? "http://localhost:8786";
    this.secret = process.env.KV_SECRET ?? "";

    if (!this.secret) {
      this.logger.warn("KV_SECRET is not set — verification will fail");
    }
  }

  /**
   * Verify that a task exists in KV (for create).
   * Returns true if kv-service returns 200.
   */
  async verifyExists(
    taskId: string,
    correlationId: string,
  ): Promise<boolean> {
    const { status } = await this.fetchTask(taskId, correlationId);
    return status === 200;
  }

  /**
   * Verify that a task was updated in KV and matches expected data.
   * Compares status and title fields from the response.
   */
  async verifyUpdated(
    taskId: string,
    expected: Task,
    correlationId: string,
  ): Promise<boolean> {
    const { status, body } = await this.fetchTask(taskId, correlationId);
    if (status !== 200 || !body) return false;

    const mismatches: string[] = [];
    if (body.title !== expected.title) mismatches.push(`title: "${body.title}" != "${expected.title}"`);
    if (body.status !== expected.status) mismatches.push(`status: "${body.status}" != "${expected.status}"`);

    if (mismatches.length > 0) {
      this.logger.warn(
        `[${correlationId}] KV verify mismatch for task=${taskId}: ${mismatches.join(", ")}`,
      );
      return false;
    }

    return true;
  }

  /**
   * Verify that a task was deleted from KV.
   * Returns true if kv-service returns 404.
   */
  async verifyDeleted(
    taskId: string,
    correlationId: string,
  ): Promise<boolean> {
    const { status } = await this.fetchTask(taskId, correlationId);
    return status === 404;
  }

  private async fetchTask(
    taskId: string,
    correlationId: string,
  ): Promise<{ status: number; body: Task | null }> {
    const pathname = `/tasks/${taskId}`;
    const ts = Math.floor(Date.now() / 1000).toString();
    const token = await signHmac(pathname, ts, this.secret);

    const url = `${this.kvServiceUrl}${pathname}?token=${token}&ts=${ts}`;

    try {
      const res = await fetch(url, {
        headers: { [CORELATION_ID_HEADER]: correlationId },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      this.logger.log(
        `[${correlationId}] KV verify GET ${pathname} → ${res.status}`,
      );

      let body: Task | null = null;
      if (res.status === 200) {
        try { body = await res.json() as Task; } catch {}
      }

      return { status: res.status, body };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[${correlationId}] KV verify request failed: ${msg}`,
      );
      return { status: 0, body: null };
    }
  }
}
