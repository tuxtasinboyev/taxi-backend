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

        // 🔹 Taxi category borligini tekshiramiz (agar yangisi berilgan bo‘lsa)
        if (dto.taxiCategoryId) {
            const existsTaxiCategory = await this.prisma.taxiCategory.findUnique({
                where: { id: dto.taxiCategoryId },
            });
            if (!existsTaxiCategory) throw new NotFoundException('Taxi category not found');
        }

        const updateData: Record<string, any> = Object.fromEntries(
            Object.entries(dto).filter(([_, v]) => v !== undefined)
        );


        if (dto.lang && dto.city) {
            if (dto.lang === 'uz') updateData.city_uz = dto.city;
            if (dto.lang === 'ru') updateData.city_ru = dto.city;
            if (dto.lang === 'en') updateData.city_en = dto.city;
        }

        // Bu ikki fieldni har doim Date formatiga o‘tkazamiz, agar berilgan bo‘lsa
        if (dto.valid_from) updateData.valid_from = new Date(dto.valid_from);
        if (dto.valid_to) updateData.valid_to = new Date(dto.valid_to);

        // 🔹 yangilaymiz
        const updatedRule = await this.prisma.pricingRule.update({
            where: { id },
            data: updateData,
        });

        return updatedRule;
    }

    async deletePriceRule(id: string) {
        const existingRule = await this.prisma.pricingRule.findUnique({ where: { id } });
        if (!existingRule) throw new NotFoundException('Pricing rule not found');
        await this.prisma.pricingRule.delete({ where: { id } });
        return { message: 'Pricing rule deleted successfully' };
    }
}
