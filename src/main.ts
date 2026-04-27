import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    ['/api/docs', '/api/docs-json'],
    basicAuth({
      challenge: true,
      users: {
        'yulla': 'yulla',
      },
    }),
  );

  app.enableCors();

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true, // BU JUDA MUHIM: stringdan numberga o'tkazadi
    transformOptions: { enableImplicitConversion: true }, // Avtomatik konvertatsiya
  }));

  const config = new DocumentBuilder()
    .setTitle('Taxi API')
    .setDescription('API documentation for Taxi project. Auth bo`limidagi send-otp endpointi Eskiz SMS provider orqali ishlaydi.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  console.log(`🚀 Server is running on http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`📖 Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api/docs`);
}

bootstrap();
