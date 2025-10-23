import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { urlGenerator } from 'src/common/types/generator.types';
import { DatabaseService } from 'src/config/database/database.service';
import { Language } from 'src/utils/helper';
import { CreateTaxiCategoryDto } from './dto/create.driver.dto';

@Injectable()
export class CategoryService {
    constructor(
        private prisma: DatabaseService,
        private configService: ConfigService,
    ) { }

    async createTaxiCategory(data: CreateTaxiCategoryDto, iconUrl: string) {
        const photoUrl = urlGenerator(this.configService, iconUrl);

        let existsCategory;

        if (data.language === Language.uz) {
            existsCategory = await this.prisma.taxiCategory.findUnique({
                where: { name_uz: data.name },
            });
        } else if (data.language === Language.en) {
            existsCategory = await this.prisma.taxiCategory.findUnique({
                where: { name_en: data.name },
            });
        } else if (data.language === Language.ru) {
            existsCategory = await this.prisma.taxiCategory.findUnique({
                where: { name_ru: data.name },
            });
        }

        if (existsCategory) throw new ConflictException('This category already exists');

        const created = await this.prisma.taxiCategory.create({
            data: {
                name_uz: data.language === Language.uz ? data.name : null,
                name_en: data.language === Language.en ? data.name : null,
                name_ru: data.language === Language.ru ? data.name : null,
                icon_url: photoUrl,
                is_active: data.is_active ?? true,
                price: data.price,
            },
        });

        return { data: created };
    }


    async getAllTaxiCategories(language?: Language) {
        const baseSelect = {
            id: true,
            icon_url: true,
            price: true,
            is_active: true,
            created_at: true,
        };

        if (language) {
            const fieldName =
                language === Language.uz
                    ? 'name_uz'
                    : language === Language.en
                        ? 'name_en'
                        : 'name_ru';

            const categories = await this.prisma.taxiCategory.findMany({
                where: { is_active: true },
                select: { ...baseSelect, [fieldName]: true },
            });

            return {
                data: categories.map(cat => ({
                    id: cat.id,
                    name: cat[fieldName],
                    icon_url: cat.icon_url,
                    price: cat.price,
                    is_active: cat.is_active,
                    created_at: cat.created_at,
                })),
            };
        }

        const categories = await this.prisma.taxiCategory.findMany({
            where: { is_active: true },
            select: {
                ...baseSelect,
                name_uz: true,
                name_en: true,
                name_ru: true,
            },
        });
        return { data: categories };
    }

    async getTaxiCategoryById(id: string) {
        const category = await this.prisma.taxiCategory.findUnique({ where: { id } });
        if (!category) throw new ConflictException('Category not found');
        return { data: category };
    }

    async updateTaxiCategory(id: string, data: Partial<CreateTaxiCategoryDto>, iconUrl?: string) {
        const exists = await this.prisma.taxiCategory.findUnique({ where: { id } });
        if (!exists) throw new ConflictException('Category not found');

        const photoUrl = iconUrl
            ? urlGenerator(this.configService, iconUrl)
            : exists.icon_url;

        const fieldName =
            data.language === Language.uz
                ? 'name_uz'
                : data.language === Language.en
                    ? 'name_en'
                    : data.language === Language.ru
                        ? 'name_ru'
                        : null;

        let updateData: any = {
            icon_url: photoUrl,
            is_active: data.is_active ?? exists.is_active,
            price: data.price ?? exists.price,
        };

        if (fieldName && data.name) {
            updateData[fieldName] = data.name;
        }

        const updated = await this.prisma.taxiCategory.update({
            where: { id },
            data: updateData,
        });

        return { data: updated };
    }

    async deleteTaxiCategory(id: string) {
        const exists = await this.prisma.taxiCategory.findUnique({ where: { id } });
        if (!exists) throw new ConflictException('Category not found');

        await this.prisma.taxiCategory.delete({ where: { id } });
        return { message: 'Category deleted successfully' };
    }
}
