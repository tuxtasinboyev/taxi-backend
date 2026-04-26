import { Module } from '@nestjs/common';
import { ConfigModules } from 'src/config/config.module';
import { DatabaseModule } from 'src/config/database/database.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
    imports: [DatabaseModule, ConfigModules],
    providers: [ReviewService],
    controllers: [ReviewController],
})
export class ReviewModule {}
