import { Injectable, Logger } from "@nestjs/common";
import { CORELATION_ID_HEADER, signHmac } from "@task-manager/shared";
import { HTTP_TIMEOUT_MS } from "./params";
/**
 * Calls the web worker's POST /api/v1/cache/purge endpoint
 * with an HMAC-signed token to invalidate cached SSR pages.
 */
@Injectable()
export class CachePurgeService {
  private readonly logger = new Logger(CachePurgeService.name);
  private readonly webAppUrl: string;
  private readonly secret: string;

  constructor() {
    this.webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:8787";
    this.secret = process.env.KV_SECRET ?? "";

    if (!this.secret) {
      this.logger.warn("KV_SECRET is not set — cache purge will fail");
    }
  }

  async purge(taskId: string, correlationId: string): Promise<void> {
    const pathname = "/api/cache/purge";
    const ts = Math.floor(Date.now() / 1000).toString();
    const token = await signHmac(pathname, ts, this.secret);

    const url = `${this.webAppUrl}${pathname}?token=${token}&ts=${ts}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CORELATION_ID_HEADER]: correlationId,
        },
        body: JSON.stringify({ taskId }),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(
          `[${correlationId}] Purge failed (${res.status})`,
        );
        return;
      }

      this.logger.log(`[${correlationId}] Cache purged for task=${taskId}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[${correlationId}] Purge request failed: ${url} ${msg}`);
    }
  }
}
