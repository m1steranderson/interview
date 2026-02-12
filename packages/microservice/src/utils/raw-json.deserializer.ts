import type { ConsumerDeserializer, IncomingEvent } from "@nestjs/microservices";

/**
 * Custom deserializer for raw JSON messages from NATS CLI.
 *
 * NestJS NATS transport expects messages in its own format:
 *   { "pattern": "tasks.created", "data": {...}, "id": "..." }
 *
 * But `nats pub tasks.created '{"title":"Fix bug"}'` sends raw JSON.
 * This deserializer bridges the gap: it takes whatever arrives and
 * wraps it into the IncomingEvent shape NestJS expects.
 */
export class RawJsonDeserializer implements ConsumerDeserializer {
  deserialize(value: any, options?: { channel?: string }): IncomingEvent {
    let parsed = value;

    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      parsed = JSON.parse(Buffer.from(value).toString());
    } else if (typeof value === "string") {
      parsed = JSON.parse(value);
    }

    // If already in NestJS format (has pattern + data), pass through
    if (parsed?.pattern && parsed?.data !== undefined) {
      return parsed;
    }

    // Raw JSON from nats pub — wrap it
    return {
      pattern: options?.channel ?? "unknown",
      data: parsed,
    };
  }
}
