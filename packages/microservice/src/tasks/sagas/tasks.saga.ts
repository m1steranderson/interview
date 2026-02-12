import { Injectable, Logger } from "@nestjs/common";
import { Saga, ofType } from "@nestjs/cqrs";
import type { ICommand } from "@nestjs/cqrs";
import { type Observable, mergeMap, map, timer, EMPTY } from "rxjs";
import { KvWriteFailedEvent } from "../events";
import { RETRY_DELAYS, MAX_RETRIES } from "../../common/params";

/**
 * Saga: retry failed KV writes with backoff.
 *
 * Flow:
 *   CommandHandler fails → publishes KvWriteFailedEvent
 *   → Saga catches it → checks attempt < MAX_RETRIES
 *   → waits RETRY_DELAYS[attempt] ms
 *   → re-dispatches the same command with attempt + 1
 *   → if attempt >= MAX_RETRIES → logs final failure, gives up
 */
@Injectable()
export class TasksSaga {
  private readonly logger = new Logger(TasksSaga.name);

  @Saga()
  retryFailedKvWrites = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(KvWriteFailedEvent),
      mergeMap((event: KvWriteFailedEvent) => {
        const { command, error } = event;
        const { attempt, correlationId } = command;

        if (attempt >= MAX_RETRIES) {
          this.logger.error(
            `[${correlationId}] GIVING UP after ${MAX_RETRIES} retries: ${error}`,
          );
          return EMPTY;
        }

        const delayMs = RETRY_DELAYS[attempt];
        this.logger.warn(
          `[${correlationId}] Retry ${attempt + 1}/${MAX_RETRIES} in ${delayMs}ms: ${error}`,
        );

        return timer(delayMs).pipe(
          map(() => command.withNextAttempt()),
        );
      }),
    );
  };
}
