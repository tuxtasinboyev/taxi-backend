import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { CreatePricingRuleDto } from './dto/create.priceRule.dto';

@Injectable()
export class PriceService {
    constructor(private prisma: DatabaseService) { }
    async createPriceRule(dto: CreatePricingRuleDto) {
        const existingRule = await this.prisma.pricingRule.findFirst({ where: { is_active: true } });
        if (existingRule) {
            await this.prisma.pricingRule.update({
                where: { id: existingRule.id },
                data: { is_active: false }
            })
        }
        
        if (dto.taxiCategoryId) {
            const existsTaxiCategory = await this.prisma.taxiCategory.findUnique({ where: { id: dto.taxiCategoryId } })
            if (!existsTaxiCategory) throw new NotFoundException('Taxi category not found')
        }
        if (dto.lang === 'uz') {
            const createRule = await this.prisma.pricingRule.create({
                data: {
                    city_uz: dto.city,
                    base_fare: dto.base_fare,
                    per_km: dto.per_km,
                    per_min: dto.per_min,
                    surge_multiplier: dto.surge_multiplier,
                    currency: dto.currency,
                    is_active: dto.is_active,
                    valid_from: new Date(dto.valid_from),
                    valid_to: dto.valid_to ? new Date(dto.valid_to) : null,
                    taxiCategoryId: dto.taxiCategoryId,
                }
            })
            return createRule
        }
        if (dto.lang === 'ru') {
            const createRule = await this.prisma.pricingRule.create({
                data: {
                    city_ru: dto.city,
                    base_fare: dto.base_fare,
                    per_km: dto.per_km,
                    per_min: dto.per_min,
                    surge_multiplier: dto.surge_multiplier,
                    currency: dto.currency,
                    is_active: dto.is_active,
                    valid_from: new Date(dto.valid_from),
                    valid_to: dto.valid_to ? new Date(dto.valid_to) : null,
                    taxiCategoryId: dto.taxiCategoryId
                }
            })
            return createRule
        }
        if (dto.lang === 'en') {
            const createRule = await this.prisma.pricingRule.create({
                data: {
                    city_en: dto.city,
                    base_fare: dto.base_fare,
                    per_km: dto.per_km,
                    per_min: dto.per_min,
                    surge_multiplier: dto.surge_multiplier,
                    currency: dto.currency,
                    is_active: dto.is_active,
                    valid_from: new Date(dto.valid_from),
                    valid_to: dto.valid_to ? new Date(dto.valid_to) : null,
                    taxiCategoryId: dto.taxiCategoryId
                }
            })
            return createRule
        }
    }
    async getActivePriceRule() {
        const activeRule = await this.prisma.pricingRule.findFirst({
            where: { is_active: true },
            include: { TaxiCategory: true },
            orderBy: { updated_at: 'desc' }
        })
        return activeRule
    }
    async getAllPriceRules() {
        const allRules = await this.prisma.pricingRule.findMany({
            include: { TaxiCategory: true },
            orderBy: { created_at: 'desc' }
        })
        return allRules
    }
    async getPriceRuleById(id: string) {
        const rule = await this.prisma.pricingRule.findUnique({
            where: { id },
            include: { TaxiCategory: true }
        })
        if (!rule) throw new NotFoundException('Pricing rule not found')
        return rule
    }
    async updatePriceRule(id: string, dto: Partial<CreatePricingRuleDto>) {
        const existingRule = await this.prisma.pricingRule.findUnique({ where: { id } });
        if (!existingRule) throw new NotFoundException('Pricing rule not found');
        if (dto.taxiCategoryId) {
            const existsTaxiCategory = await this.prisma.taxiCategory.findUnique({ where: { id: dto.taxiCategoryId } })
            if (!existsTaxiCategory) throw new NotFoundException('Taxi category not found')
        }
        const updatedRule = await this.prisma.pricingRule.update({
            where: { id },
            data: {
                city_uz: dto.lang === 'uz' ? dto.city : existingRule.city_uz,
                city_ru: dto.lang === 'ru' ? dto.city : existingRule.city_ru,
                city_en: dto.lang === 'en' ? dto.city : existingRule.city_en,
                base_fare: dto.base_fare ?? existingRule.base_fare,
                per_km: dto.per_km ?? existingRule.per_km,
                per_min: dto.per_min ?? existingRule.per_min,
                surge_multiplier: dto.surge_multiplier ?? existingRule.surge_multiplier,
                currency: dto.currency ?? existingRule.currency,
                is_active: dto.is_active ?? existingRule.is_active,
                valid_from: dto.valid_from ? new Date(dto.valid_from) : existingRule.valid_from,
                valid_to: dto.valid_to ? new Date(dto.valid_to) : existingRule.valid_to,
                taxiCategoryId: dto.taxiCategoryId ?? existingRule.taxiCategoryId,
            }
        })
        return updatedRule
    }
    async deletePriceRule(id: string) {
        const existingRule = await this.prisma.pricingRule.findUnique({ where: { id } });
        if (!existingRule) throw new NotFoundException('Pricing rule not found');
        await this.prisma.pricingRule.delete({ where: { id } });
        return { message: 'Pricing rule deleted successfully' };
    }
}
