import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { GuardService } from './guard.service';

@Global()
@Module({
  imports: [ConfigModule, JwtModule.register({ global: true })],
  providers: [GuardService],
  exports: [GuardService],
})
export class GuardModule { }
