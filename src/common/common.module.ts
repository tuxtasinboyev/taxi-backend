import { Module } from '@nestjs/common';
import { GuardModule } from './guard/guard.module';
import { RoleGuardModule } from './role_guard/role_guard.module';
import { ConfigModules } from 'src/config/config.module';
import { SmsService } from './services/sms.service';

@Module({
    imports: [GuardModule, RoleGuardModule,ConfigModules],
    providers:[SmsService],
    exports:[SmsService]

})
export class CommonModule { }
