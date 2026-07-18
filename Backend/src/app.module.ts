import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TriageModule } from './triage/triage.module';
import { ConsentModule } from './consent/consent.module';
import { AuditModule } from './audit/audit.module';
import { FeedbackModule } from './feedback/feedback.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),
    PrismaModule,
    CommonModule,
    IntegrationsModule,
    AuthModule,
    UsersModule,
    TriageModule,
    ConsentModule,
    AuditModule,
    FeedbackModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
