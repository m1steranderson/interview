import { CommandHandler, EventBus, type ICommandHandler } from "@nestjs/cqrs";
import { Inject, Logger } from "@nestjs/common";
import { UpdateTaskCommand } from "../commands/update-task.command";
import { KvWriteFailedEvent, KvWriteSucceededEvent } from "../events";
import {
  TASK_REPOSITORY,
  type ITaskRepository,
} from "../domain/task.repository";
import { KvVerifyService } from "../../common/kv-verify.service";

@CommandHandler(UpdateTaskCommand)
export class UpdateTaskHandler implements ICommandHandler<UpdateTaskCommand> {
  private readonly logger = new Logger(UpdateTaskHandler.name);

  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly eventBus: EventBus,
    private readonly kvVerify: KvVerifyService,
  ) {}

  async execute(command: UpdateTaskCommand): Promise<void> {
    const { payload, correlationId, attempt } = command;

    try {
      this.logger.log(
        `[${correlationId}] UPDATE task=${payload.id} attempt=${attempt}`,
      );

      const task = await this.repo.findById(payload.id, correlationId);
      if (!task) {
        this.logger.warn(
          `[${correlationId}] Task ${payload.id} not found — skipping update`,
        );
        return;
      }

      try {
        task.update(payload);
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : String(validationError);
        this.logger.error(
          `[${correlationId}] UPDATE task=${payload.id} attempt=${attempt} VALIDATION FAILED: ${message}`,
        );
        // Validation errors are not retriable — do not publish KvWriteFailedEvent
        return;
      }

      const res = await this.repo.save(task, correlationId);
      if (!res) {
        this.logger.warn(
          `[${correlationId}] UPDATE task=${payload.id} attempt=${attempt} FAILED: repository returned false`,
        );
        this.eventBus.publish(new KvWriteFailedEvent(command, "Repository save operation failed"));
        return;
      }

      const verified = await this.kvVerify.verifyUpdated(
        payload.id,
        task.toPersistence(),
        correlationId,
      );
      if (!verified) {
        this.logger.warn(
          `[${correlationId}] UPDATE task=${payload.id} attempt=${attempt} verification FAILED`,
        );
        this.eventBus.publish(new KvWriteFailedEvent(command, "KV read-back verification failed"));
        return;
      }

      this.eventBus.publish(
        new KvWriteSucceededEvent("update", payload.id, correlationId),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `[${correlationId}] UPDATE task=${payload.id} attempt=${attempt} FAILED: ${message}`,
      );

      this.eventBus.publish(new KvWriteFailedEvent(command, message));
    }
  }
}
