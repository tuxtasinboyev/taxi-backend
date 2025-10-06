import { Global, Module } from '@nestjs/common';
import { JwtServices } from './jwt.service';
import { JwtModule } from '@nestjs/jwt';
@Global()
@Module({
  imports:[JwtModule],
  providers: [JwtServices],
  exports:[JwtServices],
})
export class JwtModules { }
