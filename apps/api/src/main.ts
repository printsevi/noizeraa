import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const APP_ROLE = process.env.APP_ROLE ?? "api";

async function bootstrap() {
  if (APP_ROLE === "api") {
    const app = await NestFactory.create(AppModule);
    await app.listen(process.env.PORT ?? 3000);
    return;
  }

  // worker-media / worker-general: same image, same domain layer, no
  // HTTP listener (tech proposal §2). No queue consumers are registered
  // yet — see the module list in CLAUDE.md — so this just keeps the
  // process alive until the first one is added, test-first.
  await NestFactory.createApplicationContext(AppModule);
  console.log(
    `noizera api started with APP_ROLE=${APP_ROLE} (no consumers registered yet)`,
  );
}

void bootstrap();
