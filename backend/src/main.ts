import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from '@/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.enableCors();

  const uploadsPath = join(__dirname, '..', 'uploads', 'logos');
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/logos',
  });

  const documentsPath = join(__dirname, '..', 'uploads', 'documents');
  app.useStaticAssets(documentsPath, {
    prefix: '/uploads/documents',
  });

  const config = new DocumentBuilder()
    .setTitle('ITCA PP System API')
    .setDescription(
      'Sistema web inteligente para gestión automatizada de prácticas profesionales ITCA-FEPADE',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingrese el token JWT',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'ITCA PP System API',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = configService.get<number>('port');
  if (!port) {
    throw new Error('PORT no está configurado en las variables de entorno');
  }
  await app.listen(port);
}
void bootstrap();
