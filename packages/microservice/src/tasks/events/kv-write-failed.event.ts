import type { TaskCommand } from "../commands";

/**
 * Published when a KV write fails.
 * Carries the original command so the Saga can re-dispatch it.
 */
export class KvWriteFailedEvent {
  constructor(
    public readonly command: TaskCommand,
    public readonly error: string,
  ) {}
}
