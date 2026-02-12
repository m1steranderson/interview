import { CreateTaskHandler } from "./create-task.handler";
import { UpdateTaskHandler } from "./update-task.handler";
import { DeleteTaskHandler } from "./delete-task.handler";
import { CachePurgeHandler } from "./cache-purge.handler";

export const CommandHandlers = [
  CreateTaskHandler,
  UpdateTaskHandler,
  DeleteTaskHandler,
];

export const EventHandlers = [CachePurgeHandler];
