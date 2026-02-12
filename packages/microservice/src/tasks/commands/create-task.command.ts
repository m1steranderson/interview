import type { TaskCreatedPayload } from "@task-manager/shared";
import type { Retryable } from "./retryable";

export class CreateTaskCommand implements Retryable {
  constructor(
    public readonly payload: TaskCreatedPayload,
    public readonly correlationId: string,
    public readonly attempt = 0,
  ) {}

  withNextAttempt(): CreateTaskCommand {
    return new CreateTaskCommand(
      this.payload,
      this.correlationId,
      this.attempt + 1,
    );
  }
}
