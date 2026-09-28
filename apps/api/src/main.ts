import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { UniformErrorFilter } from "./common/uniform-error.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new UniformErrorFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("DocuMind API")
    .setDescription("RAG de documentos validado por humano")
    .setVersion("v1")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  console.log(`[api] listening on http://localhost:${port}/api/v1 (docs: /docs)`);
}

void bootstrap();
