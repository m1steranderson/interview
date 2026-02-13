import { Controller, Logger } from "@nestjs/common";
import { EventPattern, Payload, Ctx } from "@nestjs/microservices";
import { CommandBus } from "@nestjs/cqrs";
import type { NatsContext } from "@nestjs/microservices";
import {
  type TaskCreatedPayload,
  type TaskUpdatedPayload,
  type TaskDeletedPayload,
} from "@task-manager/shared";
import {
  CreateTaskCommand,
  UpdateTaskCommand,
  DeleteTaskCommand
} from "./commands/";

import {
  NATS_SUBJECTS,
} from "../common/params";
/**
 * NATS event listener.
 * Thin layer: validates payload, dispatches command to CommandBus.
 * All business logic lives in CommandHandlers.
 * Retry logic lives in TasksSaga.
 */
@Controller()
export class TasksController {
  private readonly logger = new Logger(TasksController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @EventPattern(NATS_SUBJECTS.CREATED)
  async handleCreated(
    @Payload() data: TaskCreatedPayload,
    @Ctx() context: NatsContext,
  ): Promise<void> {
    const correlationId = data['correlationId'] ?? crypto.randomUUID();

    this.logger.log(
      `[${correlationId}] ${context.getSubject()} — id=${data.id}`,
    );

    await this.commandBus.execute(
      new CreateTaskCommand(data, correlationId),
    );
  }

  @EventPattern(NATS_SUBJECTS.UPDATED)
  async handleUpdated(
    @Payload() data: TaskUpdatedPayload,
    @Ctx() context: NatsContext,
  ): Promise<void> {
    const correlationId = data['correlationId'] ?? crypto.randomUUID();

    if (!data.id || typeof data.id !== "string") {
      this.logger.warn(`[${correlationId}] ${context.getSubject()} — missing id, skipping`);
      return;
    }

    this.logger.log(
      `[${correlationId}] ${context.getSubject()} — id=${data.id}`,
    );

    await this.commandBus.execute(
      new UpdateTaskCommand(data, correlationId),
    );
  }

  @EventPattern(NATS_SUBJECTS.DELETED)
  async handleDeleted(
    @Payload() data: TaskDeletedPayload,
    @Ctx() context: NatsContext,
  ): Promise<void> {
    const correlationId = data['correlationId'] ?? crypto.randomUUID();

    if (!data.id || typeof data.id !== "string") {
      this.logger.warn(`[${correlationId}] ${context.getSubject()} — missing id, skipping`);
      return;
    }

    this.logger.log(
      `[${correlationId}] ${context.getSubject()} — id=${data.id}`,
    );

    await this.commandBus.execute(
      new DeleteTaskCommand(data.id, correlationId),
    );
  }
}
