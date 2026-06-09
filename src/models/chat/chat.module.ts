import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DatabaseModule } from 'src/config/database/database.module';
import { SesionsModule } from 'src/core/sesions/sesions.module';
import { ChatGateway } from './chat.gataway';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports:[DatabaseModule,SesionsModule, NotificationModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway]
})
export class ChatModule {}
