import { Global, Module } from '@nestjs/common';
import { SessionManager } from './sesions.service';
@Global()
@Module({
  providers: [SessionManager],
  exports: [SessionManager]
})
export class SesionsModule { }
