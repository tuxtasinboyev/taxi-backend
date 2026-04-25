import { Module, OnModuleInit } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { ConfigModules } from './config/config.module';
import { CoreModule } from './core/core.module';
import { ModelsModule } from './models/models.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SeederService } from './models/seaders/seaders.service';
@Module({
  imports: [ConfigModules, CommonModule, ModelsModule, CoreModule, ScheduleModule.forRoot()],
  controllers: [],
  providers: [SeederService],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly seederService: SeederService) { }

  async onModuleInit() {
    await this.seederService.seedAdmin();
  }
}
