import { Module } from '@nestjs/common';
import { ConfigModules } from 'src/config/config.module';
import { DatabaseModule } from 'src/config/database/database.module';
import { CardController } from './card.controller';
import { CardService } from './card.service';

@Module({
    imports: [DatabaseModule, ConfigModules],
    providers: [CardService],
    controllers: [CardController],
})
export class CardModule {}
