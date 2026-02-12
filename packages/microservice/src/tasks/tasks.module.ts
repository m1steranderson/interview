import { Module, Logger } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { TasksController } from "./tasks.controller";
import { TASK_REPOSITORY } from "./domain/task.repository";
import { KvTaskRepository } from "./infrastructure/kv-task.repository";
import { InMemoryTaskRepository } from "./infrastructure/in-memory-task.repository";
import { CommandHandlers, EventHandlers } from "./handlers";
import { TasksSaga } from "./sagas/tasks.saga";
import { CachePurgeService } from "../common/cache-purge.service";
import { KvVerifyService } from "../common/kv-verify.service";

const useInMemory = process.env.USE_IN_MEMORY_KV === "true";

if (useInMemory) {
  new Logger("TasksModule").warn("Using IN-MEMORY repository (data is ephemeral)");
}

@Module({
  imports: [CqrsModule],
  controllers: [TasksController],
  providers: [
    {
      provide: TASK_REPOSITORY,
      useClass: useInMemory ? InMemoryTaskRepository : KvTaskRepository,
    },
    CachePurgeService,
    KvVerifyService,
    ...CommandHandlers,
    ...EventHandlers,
    TasksSaga,
  ],
})
export class TasksModule {}
