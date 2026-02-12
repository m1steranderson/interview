import type { TaskUpdatedPayload } from "@task-manager/shared";
import type { Retryable } from "./retryable";

export class UpdateTaskCommand implements Retryable {
  constructor(
    public readonly payload: TaskUpdatedPayload,
    public readonly correlationId: string,
    public readonly attempt = 0,
  ) {}

  withNextAttempt(): UpdateTaskCommand {
    return new UpdateTaskCommand(
      this.payload,
      this.correlationId,
      this.attempt + 1,
    );
  }
}
