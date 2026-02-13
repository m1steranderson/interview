import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { Logger } from "@nestjs/common";
import { KvWriteSucceededEvent } from "../events";
import { CachePurgeService } from "../../common/cache-purge.service";

/**
 * Listens for successful KV writes and purges the web worker cache.
 * Fire-and-forget — purge failure does not affect the write flow.
 */
@EventsHandler(KvWriteSucceededEvent)
export class CachePurgeHandler implements IEventHandler<KvWriteSucceededEvent> {
  private readonly logger = new Logger(CachePurgeHandler.name);

  constructor(private readonly cachePurge: CachePurgeService) {}

  async handle(event: KvWriteSucceededEvent): Promise<void> {
    this.logger.log(
      `[${event.correlationId}] ${event.operation} succeeded → purging cache for task=${event.taskId}`,
    );

    if (process.env.WITH_WEB_CACHE !== "true") {
      this.logger.debug(`[${event.correlationId}] Cache disabled, skipping purge`);
      return;
    }

    await this.cachePurge.purge(event.taskId, event.correlationId);
  }
}
