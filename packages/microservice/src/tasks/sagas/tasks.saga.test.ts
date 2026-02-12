import { Subject } from "rxjs";
import { TestScheduler } from "rxjs/testing";
import { TasksSaga } from "./tasks.saga";
import { KvWriteFailedEvent } from "../events";
import { CreateTaskCommand } from "../commands/create-task.command";
import { RETRY_DELAYS, MAX_RETRIES } from "../../common/params";

describe("TasksSaga", () => {
  let saga: TasksSaga;

  beforeEach(() => {
    saga = new TasksSaga();
  });

  const makeCommand = (attempt = 0) =>
    new CreateTaskCommand(
      { id: "t-1", title: "Test", correlationId: "cid-1" },
      "cid-1",
      attempt,
    );

  it("should re-dispatch command with attempt+1 after delay", (done) => {
    const events$ = new Subject<any>();
    const output$ = saga.retryFailedKvWrites(events$);

    const cmd = makeCommand(0);

    output$.subscribe((retried) => {
      expect(retried).toBeInstanceOf(CreateTaskCommand);
      expect((retried as CreateTaskCommand).attempt).toBe(1);
      expect((retried as CreateTaskCommand).correlationId).toBe("cid-1");
      done();
    });

    events$.next(new KvWriteFailedEvent(cmd, "KV timeout"));
  });

  it("should use correct delay for each attempt", () => {
    expect(RETRY_DELAYS).toEqual([1_000, 3_000, 10_000, 20_000, 30_000]);
    expect(MAX_RETRIES).toBe(5);
  });

  it("should give up after MAX_RETRIES attempts (emit nothing)", (done) => {
    const events$ = new Subject<any>();
    const output$ = saga.retryFailedKvWrites(events$);

    const emitted: any[] = [];
    output$.subscribe((val) => emitted.push(val));

    const cmd = makeCommand(MAX_RETRIES); // attempt = 5, should give up
    events$.next(new KvWriteFailedEvent(cmd, "KV timeout"));

    // EMPTY completes synchronously, so check on next tick
    setTimeout(() => {
      expect(emitted).toHaveLength(0);
      done();
    }, 50);
  });

  it("withNextAttempt should increment attempt", () => {
    const cmd = makeCommand(2);
    const next = cmd.withNextAttempt();

    expect(next.attempt).toBe(3);
    expect(next.correlationId).toBe(cmd.correlationId);
    expect(next.payload).toBe(cmd.payload);
  });
});
