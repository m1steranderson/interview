import { CommandHandler, EventBus, type ICommandHandler } from "@nestjs/cqrs";
import { Inject, Logger } from "@nestjs/common";
import { CreateTaskCommand } from "../commands/create-task.command";
import { KvWriteFailedEvent, KvWriteSucceededEvent } from "../events";
import {
  TASK_REPOSITORY,
  type ITaskRepository,
} from "../domain/task.repository";
import { TaskEntity } from "../domain/task.entity";
import { KvVerifyService } from "../../common/kv-verify.service";

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  private readonly logger = new Logger(CreateTaskHandler.name);

  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly eventBus: EventBus,
    private readonly kvVerify: KvVerifyService,
  ) {}

  async execute(command: CreateTaskCommand): Promise<void> {
    const { payload, correlationId, attempt } = command;

    try {
      this.logger.log(
        `[${correlationId}] CREATE task=${payload.id} attempt=${attempt}`,
      );

      try {
        const task = TaskEntity.create(payload);
        const res = await this.repo.save(task, correlationId);
        if (!res) {
          this.logger.warn(
            `[${correlationId}] CREATE task=${payload.id} attempt=${attempt} FAILED: repository returned false`,
          );
          this.eventBus.publish(new KvWriteFailedEvent(command, "Repository save operation failed"));
          return;
        }
      } catch (validationError) {
        const message = validationError instanceof Error ? validationError.message : String(validationError);
        this.logger.error(
          `[${correlationId}] CREATE task=${payload.id} attempt=${attempt} VALIDATION or SAVE has FAILED: ${message}`,
        );
        // Validation errors are not retriable — do not publish KvWriteFailedEvent
        return;
      }

      const verified = await this.kvVerify.verifyExists(payload.id, correlationId);
      if (!verified) {
        this.logger.warn(
          `[${correlationId}] CREATE task=${payload.id} attempt=${attempt} verification FAILED`,
        );
        this.eventBus.publish(new KvWriteFailedEvent(command, "KV read-back verification failed"));
        return;
      }

      this.eventBus.publish(
        new KvWriteSucceededEvent("create", payload.id, correlationId),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `[${correlationId}] CREATE task=${payload.id} attempt=${attempt} FAILED: ${message}`,
      );

      this.eventBus.publish(new KvWriteFailedEvent(command, message));
    }
  }
}
