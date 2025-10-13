import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { urlGenerator } from 'src/common/types/generator.types';
import { DatabaseService } from 'src/config/database/database.service';
import { Language } from 'src/utils/helper';
import { CreateTaxiCategoryDto } from './dto/create.driver.dto';

@Injectable()
export class CategoryService {
    constructor(private prisma: DatabaseService, private configService: ConfigService) { }
    async createTaxiCategory(data: CreateTaxiCategoryDto, iconUrl: string) {
        const photoUrl = urlGenerator(this.configService, iconUrl)
        if (data.language === Language.uz) {
            const existsCategory = await this.prisma.taxiCategory.findUnique({ where: { name_uz: data.name } })
            if (existsCategory) throw new ConflictException('this category already exists')

            const create = await this.prisma.taxiCategory.create({
                data: {
                    name_uz: data.name,
                    icon_url: photoUrl,
                    is_active: data.is_active !== undefined ? data.is_active : true,
                }
            })
            return {
                data: create
            }
        }
        if (data.language === Language.en) {
            const existsCategory = await this.prisma.taxiCategory.findUnique({ where: { name_en: data.name } })
            if (existsCategory) throw new ConflictException('this category already exists')
            const create = await this.prisma.taxiCategory.create({
                data: {
                    name_en: data.name,
                    icon_url: photoUrl,
                    is_active: data.is_active !== undefined ? data.is_active : true,
                }
            })
            return {
                data: create
            }
        }
        if (data.language === Language.ru) {
            const existsCategory = await this.prisma.taxiCategory.findUnique({ where: { name_ru: data.name } })
            if (existsCategory) throw new ConflictException('this category already exists')
            const create = await this.prisma.taxiCategory.create({
                data: {
                    name_ru: data.name,
                    icon_url: photoUrl,
                    is_active: data.is_active !== undefined ? data.is_active : true,
                }
            })
            return {
                data: create
            }
        }
    }
    async getAllTaxiCategories(language?: Language) {
        if (language) {
            if (language === Language.uz) {
                const categories = await this.prisma.taxiCategory.findMany({
                    where: { is_active: true },
                    select: {
                        id: true,
                        name_uz: true,
                        icon_url: true,
                        is_active: true,
                        created_at: true,
                    }
                })
                return {
                    data: categories.map(cat => ({
                        id: cat.id,
                        name: cat.name_uz,
                        icon_url: cat.icon_url,
                        is_active: cat.is_active,
                        created_at: cat.created_at,
                    }))
                }
            }
            if (language === Language.en) {
                const categories = await this.prisma.taxiCategory.findMany({
                    where: { is_active: true },
                    select: {
                        id: true,
                        name_en: true,
                        icon_url: true,
                        is_active: true,
                        created_at: true,
                    }
                })
                return {
                    data: categories.map(cat => ({
                        id: cat.id,
                        name: cat.name_en,
                        icon_url: cat.icon_url,
                        is_active: cat.is_active,
                        created_at: cat.created_at,
                    }))
                }
            }
            if (language === Language.ru) {
                const categories = await this.prisma.taxiCategory.findMany({
                    where: { is_active: true },
                    select: {
                        id: true,
                        name_ru: true,
                        icon_url: true,
                        is_active: true,
                        created_at: true,
                    }
                })
                return {
                    data: categories.map(cat => ({
                        id: cat.id,
                        name: cat.name_ru,
                        icon_url: cat.icon_url,
                        is_active: cat.is_active,
                        created_at: cat.created_at,
                    }))
                }
            }
        } else {
            const categories = await this.prisma.taxiCategory.findMany({
                where: { is_active: true },
                select: {
                    id: true,
                    name_uz: true,
                    name_en: true,
                    name_ru: true,
                    icon_url: true,
                    is_active: true,
                    created_at: true,
                }
            })
            return {
                data: categories
            }
        }
    }

    async getTaxiCategoryById(id: string) {
        console.log(id);
        
        const category = await this.prisma.taxiCategory.findUnique({
            where: { id:id }
        })
        if (!category) throw new ConflictException('this category not found')
        return {
            data: category
        }
    }
    async updateTaxiCategory(id: string, data: Partial<CreateTaxiCategoryDto>, iconUrl?: string) {
        const existsCategory = await this.prisma.taxiCategory.findUnique({ where: { id } })
        if (!existsCategory) throw new ConflictException('this category not found')
        const photoUrl = iconUrl ? urlGenerator(this.configService, iconUrl) : existsCategory.icon_url
        if (data.language === Language.uz) {
            if (data.name && data.name !== existsCategory.name_uz) {
                const checkName = await this.prisma.taxiCategory.findUnique({ where: { name_uz: data.name } })
                if (checkName) throw new ConflictException('this category name already exists')
            }
            const update = await this.prisma.taxiCategory.update({
                where: { id },
                data: {
                    name_uz: data.name || existsCategory.name_uz,
                    icon_url: photoUrl,
                    is_active: data.is_active !== undefined ? data.is_active : existsCategory.is_active,
                }
            })
            return {
                data: update
            }
        }
        if (data.language === Language.en) {
            if (data.name && data.name !== existsCategory.name_en) {
                const checkName = await this.prisma.taxiCategory.findUnique({
                    where: {
                        name_en: data.name
                    }
                })
                if (checkName) throw new ConflictException('this category name already exists')
            }
            const update = await this.prisma.taxiCategory.update({
                where: { id },
                data: {
                    name_en: data.name || existsCategory.name_en,
                    icon_url: photoUrl,
                    is_active: data.is_active !== undefined ? data.is_active : existsCategory.is_active,
                }
            })
            return {
                data: update
            }
        }
        if (data.language === Language.ru) {
            if (data.name && data.name !== existsCategory.name_ru) {
                const checkName = await this.prisma.taxiCategory.findUnique({ where: { name_ru: data.name } })
                if (checkName) throw new ConflictException('this category name already exists')
            }
            const update = await this.prisma.taxiCategory.update({
                where: { id },
                data: {
                    name_ru: data.name || existsCategory.name_ru,
                    icon_url: photoUrl,
                    is_active: data.is_active !== undefined ? data.is_active : existsCategory.is_active,
                }
            })
            return {
                data: update
            }
        }
        return { message: 'No valid language provided for update' }
    }
    async deleteTaxiCategory(id: string) {
        const existsCategory = await this.prisma.taxiCategory.findUnique({ where: { id } })
        if (!existsCategory) throw new ConflictException('this category not found')
        await this.prisma.taxiCategory.delete({
            where: { id }
        })
        return {
            message: 'Category deleted successfully'
        }
    }
}
