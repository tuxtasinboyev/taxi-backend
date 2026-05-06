import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DatabaseService } from 'src/config/database/database.service';
import * as bcrypt from 'bcrypt';

type SeedUserConfig = {
    name_uz: string;
    name_ru: string;
    name_en: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
};

@Injectable()
export class SeederService {
    private readonly logger = new Logger(SeederService.name);

    constructor(private readonly prisma: DatabaseService) { }

    async seedAdmin() {
        const defaultAdmin: SeedUserConfig = {
            name_uz: 'Admin',
            name_ru: 'Админ',
            name_en: 'Admin',
            email: process.env.ADMIN_EMAIL || 'admin@example.com',
            phone: process.env.ADMIN_PHONE || '+998901234567',
            password: process.env.ADMIN_PASSWORD || 'admin123',
            role: UserRole.admin,
        };

        const defaultSuperAdmin: SeedUserConfig = {
            name_uz: 'Super Admin',
            name_ru: 'Супер админ',
            name_en: 'Super Admin',
            email: process.env.SUPERADMIN_EMAIL || 'superadmin@example.com',
            phone: process.env.SUPERADMIN_PHONE || '+998901234568',
            password: process.env.SUPERADMIN_PASSWORD || 'superadmin123',
            role: UserRole.superadmin,
        };

        await this.seedPrivilegedUser(defaultAdmin);
        await this.seedPrivilegedUser(defaultSuperAdmin);
    }

    private async seedPrivilegedUser(defaultUser: SeedUserConfig) {
        const passwordHash = await bcrypt.hash(defaultUser.password, 10);

        try {
            const existingUser = await this.prisma.user.findFirst({
                where: {
                    OR: [
                        { email: defaultUser.email },
                        { phone: defaultUser.phone },
                    ],
                },
            });

            if (existingUser) {
                await this.prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        name_uz: defaultUser.name_uz,
                        name_ru: defaultUser.name_ru,
                        name_en: defaultUser.name_en,
                        email: defaultUser.email,
                        phone: defaultUser.phone,
                        password_hash: passwordHash,
                        role: defaultUser.role,
                    },
                });
                this.logger.log(`✅ ${defaultUser.role} updated: ${defaultUser.email}`);
            } else {
                await this.prisma.user.create({
                    data: {
                        name_uz: defaultUser.name_uz,
                        name_ru: defaultUser.name_ru,
                        name_en: defaultUser.name_en,
                        email: defaultUser.email,
                        phone: defaultUser.phone,
                        password_hash: passwordHash,
                        role: defaultUser.role,
                    },
                });
                this.logger.log(`✅ ${defaultUser.role} created: ${defaultUser.email}`);
            }
        } catch (error) {
            this.logger.error(`❌ ${defaultUser.role} seeder failed`, error);
        }
    }
}
