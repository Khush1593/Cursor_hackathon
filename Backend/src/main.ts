import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ACCESS_COOKIE } from './auth/auth.constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  app.enableCors({
    origin: config.get<string>('frontendOrigin'),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true, // required for HTTP-only cookies cross-origin
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aura API')
    .setDescription(
      'Aura V6 NestJS gateway. Auth uses HTTP-only Secure cookies — do not store tokens in localStorage.',
    )
    .setVersion('1.0')
    .addCookieAuth(ACCESS_COOKIE, {
      type: 'apiKey',
      in: 'cookie',
      name: ACCESS_COOKIE,
    })
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
}

void bootstrap();
