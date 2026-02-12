import { CommandHandler, EventBus, type ICommandHandler } from "@nestjs/cqrs";
import { Inject, Logger } from "@nestjs/common";
import { DeleteTaskCommand } from "../commands/delete-task.command";
import { KvWriteFailedEvent, KvWriteSucceededEvent } from "../events";
import {
  TASK_REPOSITORY,
  type ITaskRepository,
} from "../domain/task.repository";
import { KvVerifyService } from "../../common/kv-verify.service";

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand> {
  private readonly logger = new Logger(DeleteTaskHandler.name);

  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly eventBus: EventBus,
    private readonly kvVerify: KvVerifyService,
  ) {}

  async execute(command: DeleteTaskCommand): Promise<void> {
    const { taskId, correlationId, attempt } = command;

    try {
      this.logger.log(
        `[${correlationId}] DELETE task=${taskId} attempt=${attempt}`,
      );

      const res = await this.repo.delete(taskId, correlationId);

      if (!res) {
        this.logger.warn(
          `[${correlationId}] DELETE task=${taskId} attempt=${attempt} FAILED: repository returned false`,
        );
        this.eventBus.publish(new KvWriteFailedEvent(command, "Repository delete operation failed"));
        return;
      }

      const verified = await this.kvVerify.verifyDeleted(taskId, correlationId);
      if (!verified) {
        this.logger.warn(
          `[${correlationId}] DELETE task=${taskId} attempt=${attempt} verification FAILED`,
        );
        this.eventBus.publish(new KvWriteFailedEvent(command, "KV read-back verification failed"));
        return;
      }

      this.eventBus.publish(
        new KvWriteSucceededEvent("delete", taskId, correlationId),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `[${correlationId}] DELETE task=${taskId} attempt=${attempt} FAILED: ${message}`,
      );

      this.eventBus.publish(new KvWriteFailedEvent(command, message));
    }
  }
}
