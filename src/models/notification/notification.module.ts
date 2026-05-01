import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/config/database/database.module';
import { FirebaseModule } from 'src/config/firebase/firebase.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
    imports: [DatabaseModule, FirebaseModule],
    providers: [NotificationService],
    controllers: [NotificationController],
    exports: [NotificationService],
})
export class NotificationModule {}
