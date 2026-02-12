/** Retry delays in ms per spec: 1s, 3s, 10s, 20s, 30s */
export const RETRY_DELAYS = [1_000, 3_000, 10_000, 20_000, 30_000] as const;
export const MAX_RETRIES = RETRY_DELAYS.length;

/** HTTP timeout for outbound fetch calls (ms) */
export const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS) || 5_000;

/** NATS subjects */
export const NATS_SUBJECTS = {
  CREATED: "tasks.created",
  UPDATED: "tasks.updated",
  DELETED: "tasks.deleted",
} as const;