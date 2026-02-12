import { TaskEntity, TaskValidationError } from "./task.entity";

describe("TaskEntity", () => {
  describe("validation", () => {
    it("should reject missing id", () => {
      expect(() =>
        TaskEntity.create({ id: undefined as any, title: "Test" }),
      ).toThrow(TaskValidationError);
    });

    it("should reject empty title", () => {
      expect(() =>
        TaskEntity.create({ id: "t-1", title: "" }),
      ).toThrow(TaskValidationError);
    });

    it("should reject non-ASCII id", () => {
      expect(() =>
        TaskEntity.create({ id: "задача-1", title: "Test" }),
      ).toThrow(TaskValidationError);
    });

    it("should reject id with special characters", () => {
      expect(() =>
        TaskEntity.create({ id: "#?test-002", title: "Test" }),
      ).toThrow(/URL-safe/);
    });

    it("should reject invalid status", () => {
      expect(() =>
        TaskEntity.create({ id: "t-1", title: "Test", status: "invalid" as any }),
      ).toThrow(TaskValidationError);
    });

    it("should reject empty title on update", () => {
      const task = TaskEntity.create({ id: "t-1", title: "Valid" });
      expect(() => task.update({ title: "" })).toThrow(TaskValidationError);
    });

    it("should reject invalid status on update", () => {
      const task = TaskEntity.create({ id: "t-1", title: "Valid" });
      expect(() => task.update({ status: "nope" as any })).toThrow(TaskValidationError);
    });
  });

  describe("create", () => {
    it("should create a task with defaults", () => {
      const task = TaskEntity.create({ id: "t-1", title: "Buy milk" });

      expect(task.id).toBe("t-1");
      expect(task.title).toBe("Buy milk");
      expect(task.description).toBeUndefined();
      expect(task.status).toBe("pending");
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it("should accept optional status and description", () => {
      const task = TaskEntity.create({
        id: "t-2",
        title: "Fix bug",
        description: "Critical issue",
        status: "in_progress",
      });

      expect(task.description).toBe("Critical issue");
      expect(task.status).toBe("in_progress");
    });
  });

  describe("update", () => {
    it("should update only provided fields", () => {
      const task = TaskEntity.create({ id: "t-1", title: "Old title" });
      const beforeUpdate = task.updatedAt;

      // Small delay to ensure updatedAt changes
      task.update({ title: "New title" });

      expect(task.title).toBe("New title");
      expect(task.status).toBe("pending"); // unchanged
      expect(task.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
    });

    it("should update status", () => {
      const task = TaskEntity.create({ id: "t-1", title: "Task" });
      task.update({ status: "done" });

      expect(task.status).toBe("done");
    });
  });

  describe("persistence round-trip", () => {
    it("should serialize and deserialize correctly", () => {
      const original = TaskEntity.create({
        id: "t-1",
        title: "Round trip",
        description: "Test",
        status: "in_progress",
      });

      const json = original.toPersistence();
      const restored = TaskEntity.fromPersistence(json);

      expect(restored.id).toBe(original.id);
      expect(restored.title).toBe(original.title);
      expect(restored.description).toBe(original.description);
      expect(restored.status).toBe(original.status);
      expect(restored.createdAt.toISOString()).toBe(
        original.createdAt.toISOString(),
      );
    });

    it("toPersistence should return plain object with ISO dates", () => {
      const task = TaskEntity.create({ id: "t-1", title: "Check" });
      const json = task.toPersistence();

      expect(typeof json.createdAt).toBe("string");
      expect(typeof json.updatedAt).toBe("string");
      expect(json.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
