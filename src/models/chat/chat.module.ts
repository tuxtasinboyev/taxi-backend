import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DatabaseModule } from 'src/config/database/database.module';
import { SesionsModule } from 'src/core/sesions/sesions.module';
import { ChatGateway } from './chat.gataway';

@Module({
  imports:[DatabaseModule,SesionsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway]
})
export class ChatModule {}
