/**
 * Published after a successful KV write. Used for observability/logging.
 */
export class KvWriteSucceededEvent {
  constructor(
    public readonly operation: "create" | "update" | "delete",
    public readonly taskId: string,
    public readonly correlationId: string,
  ) {}
}
