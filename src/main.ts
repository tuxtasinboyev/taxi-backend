import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: true,            
      // forbidNonWhitelisted: true, 
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Taxi API')
    .setDescription('API documentation for Taxi project (OTP, Auth, etc.)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Server is running on http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`📖 Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api/docs`);
}
bootstrap();
