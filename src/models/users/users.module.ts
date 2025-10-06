import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DatabaseModule } from 'src/config/database/database.module';
import { ConfigModules } from 'src/config/config.module';

@Module({
  imports:[DatabaseModule,ConfigModules],
  providers: [UsersService],
  controllers: [UsersController]
})
export class UsersModule {}
