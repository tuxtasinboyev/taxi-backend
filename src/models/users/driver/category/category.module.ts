import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { DatabaseModule } from 'src/config/database/database.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [DatabaseModule,ConfigModule],
  providers: [CategoryService],
  controllers: [CategoryController]
})
export class CategoryModule {}
