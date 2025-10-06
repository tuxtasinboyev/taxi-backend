import { Module } from '@nestjs/common';
import { RoleGuardService } from './role_guard.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  providers: [RoleGuardService,JwtModule],
  exports: [RoleGuardService]
})
export class RoleGuardModule { }
