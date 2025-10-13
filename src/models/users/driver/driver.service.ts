import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { urlGenerator } from 'src/common/types/generator.types';
import { DatabaseService } from 'src/config/database/database.service';
import { Language } from 'src/utils/helper';
import { CreateDriverDto } from './dto/create.driver.dto';

@Injectable()
export class DriverService {
    constructor(private prisma: DatabaseService, private config: ConfigService) { }
    async createDriver(data: CreateDriverDto, photoUrl?: string) {
        const existsEmail = data.email
            ? await this.prisma.user.findUnique({ where: { email: data.email } })
            : null;

        const existsPhone = await this.prisma.user.findUnique({
            where: { phone: data.phone },
        });

        if (existsEmail || existsPhone) {
            throw new ConflictException('this driver already exists');
        }
        const existsCategory = await this.prisma.taxiCategory.findUnique({

            where: { id: data.taxi_category_id },
        });
        if (!existsCategory) {
            throw new ConflictException('this category not found');
        }

        const passwordHash = await bcrypt.hash(data.password, 10);

        let photo
        if (photoUrl) {
            photo = urlGenerator(this.config, photoUrl);
        }

        let nameField: string;
        let carModelField: string;
        let carColorField: string;

        switch (data.language) {
            case Language.uz:
                nameField = 'name_uz';
                carModelField = 'car_model_uz';
                carColorField = 'car_color_uz';
                break;
            case Language.ru:
                nameField = 'name_ru';
                carModelField = 'car_model_ru';
                carColorField = 'car_color_ru';
                break;
            case Language.en:
                nameField = 'name_en';
                carModelField = 'car_model_en';
                carColorField = 'car_color_en';
                break;
            default:
                throw new ConflictException('Invalid language');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    [nameField]: data.name,
                    phone: data.phone,
                    email: data.email,
                    role: UserRole.driver,
                    profile_photo: photo,
                    password_hash: passwordHash,
                },
            });

            const driver = await tx.driver.create({
                data: {
                    id: user.id,
                    [carModelField]: data.car_model,
                    [carColorField]: data.car_color,
                    car_number: data.car_number,
                    status: 'offline',
                    taxiCategoryId: data.taxi_category_id,
                },
            });

            return { user, driver };
        });

        const { password_hash, ...safeUser } = result.user;

        return {
            success: true,
            message: 'Driver successfully created',
            data: {
                user: safeUser,
                driver: result.driver,
            },
        };
    }
    async getAllDriver({
        page,
        limit,
        search,
        curdNumber,
        language,
    }: {
        page?: string;
        limit?: string;
        search?: string;
        curdNumber?: number;
        language?: Language;
    } = {}) {
        const pageNumber = page ? parseInt(page, 10) : 1;
        const limitNumber = limit ? parseInt(limit, 10) : 10;
        const offset = (pageNumber - 1) * limitNumber;

        const whereClause: Prisma.UserWhereInput = {
            role: UserRole.driver,
            ...(search
                ? {
                    OR: [
                        { name_uz: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        { name_ru: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        { name_en: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
                        {
                            driver: {
                                car_number: { contains: search, mode: Prisma.QueryMode.insensitive },
                            },
                        },
                    ],
                }
                : {}),
        };

        const [totalCount, drivers] = await this.prisma.$transaction([
            this.prisma.user.count({ where: whereClause }),
            this.prisma.user.findMany({
                where: whereClause,
                include: {
                    driver: true,
                },
                skip: offset,
                take: limitNumber,
                orderBy: { created_at: 'desc' },
            }),
        ]);

        const totalPages = Math.ceil(totalCount / limitNumber);

        const safeDrivers = drivers.map(({ password_hash, ...user }) => user);
        return {
            success: true,
            message: 'Drivers retrieved successfully',
            data: {
                drivers: safeDrivers,
                pagination: {
                    totalItems: totalCount,
                    totalPages,
                    currentPage: pageNumber,
                    itemsPerPage: limitNumber,
                    curdNumber: curdNumber || 0,
                },
            },
        };
    }


    async getDriverById(id: string) {
        const driver = await this.prisma.user.findUnique({
            where: { id, role: UserRole.driver },
            include: { driver: true },
        });

        if (!driver) {
            return {
                success: false,
                message: 'Driver not found',
            };
        }

        const { password_hash, ...safeUser } = driver;

        return {
            success: true,
            message: 'Driver retrieved successfully',
            data: safeUser,
        };
    }
    async getMe(id: string) {
        const driver = await this.prisma.user.findUnique({
            where: { id, role: UserRole.driver },
            include: { driver: true },
        });

        if (!driver) {
            return {
                success: false,
                message: 'Driver not found',
            };
        }

        const { password_hash, ...safeUser } = driver;

        return {
            success: true,
            message: 'Driver retrieved successfully',
            data: safeUser,
        };
    }
    async updatateDriver(id: string, data: Partial<CreateDriverDto>, photoUrl?: string) {
        const driver = await this.prisma.user.findUnique({ where: { id, role: UserRole.driver } });

        if (!driver) {
            return {
                success: false,
                message: 'Driver not found',
            };
        }
        const existsCategory = data.taxi_category_id ? await this.prisma.taxiCategory.findUnique({

            where: { id: data.taxi_category_id },
        }) : null;
        if (data.taxi_category_id && !existsCategory) {
            throw new ConflictException('this category not found');
        }

        if (data.email && data.email !== driver.email) {
            const emailExists = await this.prisma.user.findUnique({
                where: { email: data.email },
            });
            if (emailExists) {
                throw new ConflictException('Email already in use');
            }
        }

        if (data.phone && data.phone !== driver.phone) {
            const phoneExists = await this.prisma.user.findUnique({
                where: { phone: data.phone },
            });
            if (phoneExists) {
                throw new ConflictException('Phone number already in use');
            }
        }

        let passwordHash: string | undefined;
        if (data.password) {
            passwordHash = await bcrypt.hash(data.password, 10);
        }

        let photo
        if (photoUrl) {
            photo = urlGenerator(this.config, photoUrl);
        }

        let nameField: string | undefined;
        let carModelField: string | undefined;
        let carColorField: string | undefined;

        if (data.language) {
            switch (data.language) {
                case Language.uz:
                    nameField = 'name_uz';
                    carModelField = 'car_model_uz';
                    carColorField = 'car_color_uz';
                    break;
                case Language.ru:
                    nameField = 'name_ru';
                    carModelField = 'car_model_ru';
                    carColorField = 'car_color_ru';
                    break;
                case Language.en:
                    nameField = 'name_en';
                    carModelField = 'car_model_en';
                    carColorField = 'car_color_en';
                    break;
                default:
                    throw new ConflictException('Invalid language');
            }
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id },
                data: {
                    ...(nameField && data.name ? { [nameField]: data.name } : {}),
                    phone: data.phone,
                    email: data.email,
                    profile_photo: photo,
                    ...(passwordHash ? { password_hash: passwordHash } : {}),
                },
            });
            const updatedDriver = await tx.driver.update({
                where: { id },
                data: {
                    ...(carModelField && data.car_model ? { [carModelField]: data.car_model } : {}),
                    ...(carColorField && data.car_color ? { [carColorField]: data.car_color } : {}),
                    car_number: data.car_number,
                    taxiCategoryId: data.taxi_category_id,
                },
            });

            return { updatedUser, updatedDriver };
        });

        const { password_hash, ...safeUser } = result.updatedUser;

        return {
            success: true,
            message: 'Driver successfully updated',
            data: {
                user: safeUser,
                driver: result.updatedDriver,
            },
        };
    }
    async updateMe(id: string, data: Partial<CreateDriverDto>, photoUrl?: string) {
        const driver = await this.prisma.user.findUnique({ where: { id, role: UserRole.driver } });

        if (!driver) {
            return {
                success: false,
                message: 'Driver not found',
            };
        }
        const existsCategory = data.taxi_category_id ? await this.prisma.taxiCategory.findUnique({
            where: { id: data.taxi_category_id },
        }) : null;
        if (data.taxi_category_id && !existsCategory) {
            throw new ConflictException('this category not found');
        }

        if (data.email && data.email !== driver.email) {
            const emailExists = await this.prisma.user.findUnique({
                where: { email: data.email },
            });
            if (emailExists) {
                throw new ConflictException('Email already in use');
            }
        }

        if (data.phone && data.phone !== driver.phone) {
            const phoneExists = await this.prisma.user.findUnique({
                where: { phone: data.phone },
            });
            if (phoneExists) {
                throw new ConflictException('Phone number already in use');
            }
        }

        let passwordHash: string | undefined;
        if (data.password) {
            passwordHash = await bcrypt.hash(data.password, 10);
        }
        let photo
        if (photoUrl) {
            photo = urlGenerator(this.config, photoUrl);
        }

        let nameField: string | undefined;
        let carModelField: string | undefined;
        let carColorField: string | undefined;

        if (data.language) {
            switch (data.language) {
                case Language.uz:
                    nameField = 'name_uz';
                    carModelField = 'car_model_uz';
                    carColorField = 'car_color_uz';
                    break;
                case Language.ru:
                    nameField = 'name_ru';
                    carModelField = 'car_model_ru';
                    carColorField = 'car_color_ru';
                    break;
                case Language.en:
                    nameField = 'name_en';
                    carModelField = 'car_model_en';
                    carColorField = 'car_color_en';
                    break;
                default:
                    throw new ConflictException('Invalid language');
            }
        }

        const result = await this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id },
                data: {
                    ...(nameField && data.name ? { [nameField]: data.name } : {}),
                    phone: data.phone,
                    email: data.email,
                    profile_photo: photo,
                    ...(passwordHash ? { password_hash: passwordHash } : {}),
                },
            });
            const updatedDriver = await tx.driver.update({
                where: { id },
                data: {
                    ...(carModelField && data.car_model ? { [carModelField]: data.car_model } : {}),
                    ...(carColorField && data.car_color ? { [carColorField]: data.car_color } : {}),
                    car_number: data.car_number,
                    taxiCategoryId: data.taxi_category_id,
                },
            });

            return { updatedUser, updatedDriver };
        });

        const { password_hash, ...safeUser } = result.updatedUser;

        return {
            success: true,
            message: 'Driver successfully updated',
            data: {
                user: safeUser,
                driver: result.updatedDriver,
            },
        };
    }
    async deleteDriver(id: string) {
        const driver = await this.prisma.user.findUnique({ where: { id, role: UserRole.driver } });

        if (!driver) {
            return {
                success: false,
                message: 'Driver not found',
            };
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.driver.delete({ where: { id } });
            await tx.user.delete({ where: { id } });
        });

        return {
            success: true,
            message: 'Driver successfully deleted',
        };
    }
}
