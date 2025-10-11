import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { ConfigModules } from './config/config.module';
import { OtpModule } from './config/email-service/otp/otp.module';
import { CoreModule } from './core/core.module';
import { ModelsModule } from './models/models.module';
import { ScheduleModule } from '@nestjs/schedule';
@Module({
  imports: [ConfigModules, CommonModule, OtpModule, ModelsModule, CoreModule, ScheduleModule.forRoot()],
  controllers: [],
  providers: [],
})
export class AppModule { }
