import type { Retryable } from "./retryable";

export class DeleteTaskCommand implements Retryable {
  constructor(
    public readonly taskId: string,
    public readonly correlationId: string,
    public readonly attempt = 0,
  ) {}

  withNextAttempt(): DeleteTaskCommand {
    return new DeleteTaskCommand(
      this.taskId,
      this.correlationId,
      this.attempt + 1,
    );
  }
}
