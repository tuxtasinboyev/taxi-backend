import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModules } from '../config.module';
import { DatabaseService } from './database.service';
@Global()
@Module({
  imports: [JwtModule],
  providers: [DatabaseService],
  exports: [DatabaseService]
})
export class DatabaseModule { }
