import { NestFactory } from "@nestjs/core";
import { Transport, type MicroserviceOptions } from "@nestjs/microservices";
import { AppModule } from "./app.module";
import { RawJsonDeserializer } from "./utils/raw-json.deserializer";

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL ?? "nats://localhost:4222"],
        deserializer: new RawJsonDeserializer(),
      },
    },
  );

  await app.listen();
  console.log("Microservice is listening on NATS");
}

bootstrap();
