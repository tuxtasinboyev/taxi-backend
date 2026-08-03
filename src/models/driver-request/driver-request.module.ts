import { Module } from '@nestjs/common';
import { DriverRequestController } from './driver-request.controller';
import { DriverRequestService } from './driver-request.service';
import { SocketGateway } from 'src/models/socket/socket.gateway';
import { ReferralModule } from 'src/models/referral/referral.module';

@Module({
    imports: [ReferralModule],
    controllers: [DriverRequestController],
    providers: [DriverRequestService, SocketGateway],
})
export class DriverRequestModule {}
