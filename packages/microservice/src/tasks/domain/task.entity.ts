import { type Task, type TaskStatus, TASK_STATUSES } from "@task-manager/shared";

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskValidationError";
  }
}

/**
 * Task Aggregate Root.
 *
 * Encapsulates business rules and state transitions.
 * Produces domain events on state changes.
 * Serializable to/from the plain Task DTO stored in KV.
 */
export class TaskEntity {
  private constructor(
    public readonly id: string,
    private _title: string,
    private _description: string | undefined,
    private _status: TaskStatus,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  // ─── Accessors ──────────────────────────────────────
  get title() { return this._title; }
  get description() { return this._description; }
  get status() { return this._status; }
  get updatedAt() { return this._updatedAt; }

  // ─── Validation ─────────────────────────────────────
  private static assertRequiredString(value: unknown, field: string): asserts value is string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new TaskValidationError(`${field} is required and must be a non-empty string`);
    }
  }

  private static assertValidId(value: string): void {
    if (!/^[A-Za-z0-9._~-]+$/.test(value)) {
      throw new TaskValidationError("id must contain only URL-safe characters (A-Z, a-z, 0-9, -, ., _, ~)");
    }
  }

  private static assertValidStatus(value: unknown): asserts value is TaskStatus {
    if (!TASK_STATUSES.includes(value as TaskStatus)) {
      throw new TaskValidationError(
        `Invalid status "${value}". Allowed: ${TASK_STATUSES.join(", ")}`,
      );
    }
  }

  // ─── Factory: create new task ───────────────────────
  static create(props: {
    id: string;
    title: string;
    description?: string;
    status?: TaskStatus;
  }): TaskEntity {
    TaskEntity.assertRequiredString(props.id, "id");
    TaskEntity.assertValidId(props.id);
    TaskEntity.assertRequiredString(props.title, "title");
    if (props.status !== undefined) TaskEntity.assertValidStatus(props.status);

    const now = new Date();
    return new TaskEntity(
      props.id,
      props.title,
      props.description,
      props.status ?? "pending",
      now,
      now,
    );
  }

  // ─── Factory: reconstitute from KV (read model) ────
  static fromPersistence(data: Task): TaskEntity {
    return new TaskEntity(
      data.id,
      data.title,
      data.description,
      data.status,
      new Date(data.createdAt),
      new Date(data.updatedAt),
    );
  }

  // ─── Behavior ───────────────────────────────────────
  update(props: {
    title?: string;
    description?: string;
    status?: TaskStatus;
  }): void {
    if (props.title !== undefined) {
      TaskEntity.assertRequiredString(props.title, "title");
      this._title = props.title;
    }
    if (props.description !== undefined) this._description = props.description;
    if (props.status !== undefined) {
      TaskEntity.assertValidStatus(props.status);
      this._status = props.status;
    }
    this._updatedAt = new Date();
  }

  // ─── Serialization ──────────────────────────────────
  toPersistence(): Task {
    return {
      id: this.id,
      title: this._title,
      description: this._description,
      status: this._status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
