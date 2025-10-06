import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from "@prisma/client";
@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {

    private logger = new Logger(DatabaseService.name)
    async onModuleInit() {
        try {
            await this.$connect()
        } catch (error) {
            this.logger.warn(`${error.message} bazaga ulanishda xatolik`)
        }
    }
    async onModuleDestroy() {
        await this.$disconnect()
    }
}
