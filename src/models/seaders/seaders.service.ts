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

const TEST_ORDERS = [
    { from: 'Yunusobod metro', to: 'Chorsu bozor', price: 15000, km: 4.2 },
    { from: 'Chilonzor-9', to: 'Aeroport', price: 32000, km: 9.8 },
    { from: 'Sergeli', to: 'Olmazor dahasi', price: 22000, km: 6.5 },
    { from: 'Mirzo Ulugbek', to: 'Shaharcha', price: 18000, km: 5.1 },
    { from: 'Yunusobod-7', to: 'Navruz bog\'i', price: 25000, km: 7.3 },
];

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
        await this.seedTestDriver();
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

    // ─── Test driver + 5 ta buyurtma + komisyonlar ──────────────────────────────

    private async seedTestDriver() {
        try {
            const phone = '+998901111111';
            const passwordHash = await bcrypt.hash('driver123', 10);

            // 1. User yaratish yoki topish
            let user = await this.prisma.user.findUnique({ where: { phone } });
            if (!user) {
                user = await this.prisma.user.create({
                    data: {
                        name_uz: 'Test Haydovchi',
                        name_ru: 'Тест Водитель',
                        name_en: 'Test Driver',
                        phone,
                        password_hash: passwordHash,
                        role: UserRole.driver,
                    },
                });
                this.logger.log(`✅ Test driver user created: ${phone}`);
            } else {
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { password_hash: passwordHash, role: UserRole.driver },
                });
                this.logger.log(`✅ Test driver user updated: ${phone}`);
            }

            // 2. Driver profil
            const driver = await this.prisma.driver.upsert({
                where: { id: user.id },
                update: { car_model_uz: 'Cobalt', car_number: '01A111AA', status: 'offline' },
                create: {
                    id: user.id,
                    car_model_uz: 'Cobalt',
                    car_model_ru: 'Кобальт',
                    car_model_en: 'Cobalt',
                    car_color_uz: 'Oq',
                    car_color_ru: 'Белый',
                    car_color_en: 'White',
                    car_number: '01A111AA',
                    status: 'offline',
                },
            });

            // 3. Wallet (bo'lmasa yaratish)
            await this.prisma.wallet.upsert({
                where: { user_id: user.id },
                update: {},
                create: { user_id: user.id, balance: 0 },
            });

            // 4. Yo'lovchi (test uchun)
            let passenger = await this.prisma.user.findUnique({ where: { phone: '+998902222222' } });
            if (!passenger) {
                passenger = await this.prisma.user.create({
                    data: {
                        name_uz: 'Test Yo\'lovchi',
                        name_ru: 'Тест Пассажир',
                        name_en: 'Test Passenger',
                        phone: '+998902222222',
                        password_hash: await bcrypt.hash('pass123', 10),
                        role: UserRole.passenger,
                    },
                });
            }
            await this.prisma.wallet.upsert({
                where: { user_id: passenger.id },
                update: {},
                create: { user_id: passenger.id, balance: 0 },
            });

            // 5. Bugungi sana uchun komisyon bor-yo'qligini tekshirish
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const existingCommissions = await this.prisma.driverCommission.count({
                where: { driver_id: driver.id, work_date: { gte: today } },
            });

            if (existingCommissions > 0) {
                this.logger.log(`ℹ️  Test driver uchun bugun allaqachon komisyon bor (${existingCommissions} ta) — skip`);
                return;
            }

            // 6. 5 ta buyurtma + komisyon yaratish
            for (let i = 0; i < TEST_ORDERS.length; i++) {
                const o = TEST_ORDERS[i];
                const price = o.price;
                const commissionAmt = price * 0.05;

                const order = await this.prisma.order.create({
                    data: {
                        user_id: passenger.id,
                        driver_id: driver.id,
                        start_lat: 41.2995 + i * 0.01,
                        start_lng: 69.2401 + i * 0.01,
                        end_lat: 41.3100 + i * 0.01,
                        end_lng: 69.2800 + i * 0.01,
                        from_address: o.from,
                        to_address: o.to,
                        distance_km: o.km,
                        price,
                        status: 'completed',
                        finished_at: new Date(),
                    },
                });

                await this.prisma.driverCommission.create({
                    data: {
                        driver_id: driver.id,
                        order_id: order.id,
                        order_amount: price,
                        percent: 5,
                        commission_amount: commissionAmt,
                        work_date: today,
                        status: 'unpaid',
                    },
                });
            }

            const totalCommission = TEST_ORDERS.reduce((s, o) => s + o.price * 0.05, 0);
            this.logger.log(`✅ Test driver: 5 ta buyurtma, jami komisyon = ${totalCommission} so'm`);
            this.logger.log(`   Login: +998901111111 / driver123`);
        } catch (error) {
            this.logger.error('❌ Test driver seeder failed', error);
        }
    }
}
