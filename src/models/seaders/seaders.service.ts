import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeederService {
    private readonly logger = new Logger(SeederService.name);

    constructor(private readonly prisma: DatabaseService) { }

    async seedAdmin() {
        const defaultAdmin = {
            name_uz: 'Admin',
            name_ru: 'Админ',
            name_en: 'Admin',
            email: process.env.ADMIN_EMAIL || 'admin@example.com',
            phone: process.env.ADMIN_PHONE || '+998901234567',
            password: process.env.ADMIN_PASSWORD || 'admin123',
        };

        const passwordHash = await bcrypt.hash(defaultAdmin.password, 10);

        try {
            const existingAdmin = await this.prisma.user.findFirst({
                where: {
                    OR: [
                        { email: defaultAdmin.email },
                        { phone: defaultAdmin.phone },
                    ],
                },
            });

            if (existingAdmin) {
                await this.prisma.user.update({
                    where: { id: existingAdmin.id },
                    data: {
                        name_uz: defaultAdmin.name_uz,
                        name_ru: defaultAdmin.name_ru,
                        name_en: defaultAdmin.name_en,
                        email: defaultAdmin.email,
                        phone: defaultAdmin.phone,
                        password_hash: passwordHash,
                        role: 'admin',
                    },
                });
                this.logger.log(`✅ Admin updated: ${defaultAdmin.email}`);
            } else {
                await this.prisma.user.create({
                    data: {
                        name_uz: defaultAdmin.name_uz,
                        name_ru: defaultAdmin.name_ru,
                        name_en: defaultAdmin.name_en,
                        email: defaultAdmin.email,
                        phone: defaultAdmin.phone,
                        password_hash: passwordHash,
                        role: 'admin',
                    },
                });
                this.logger.log(`✅ Admin created: ${defaultAdmin.email}`);
            }
        } catch (error) {
            this.logger.error('❌ Seeder failed', error);
        }
    }
}
