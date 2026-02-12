import type { ICommand } from "@nestjs/cqrs";

/**
 * Contract for commands that can be retried by the Saga.
 * Each command knows how to clone itself with attempt + 1.
 */
export interface Retryable extends ICommand {
  readonly attempt: number;
  readonly correlationId: string;
  withNextAttempt(): Retryable;
}
