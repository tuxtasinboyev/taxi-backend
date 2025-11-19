import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { CreatePromoCodeDto } from './dto/create.promocode.dto';
import { UpdatePromoCodeDto } from './dto/update.promocode';

@Injectable()
export class PromocodeService {
    constructor(private prisma: DatabaseService) { }
    async createPromocode(data: CreatePromoCodeDto) {
        const existsPromocode = await this.prisma.promoCode.findUnique({
            where: { code: data.code }
        })
        if (existsPromocode) throw new ConflictException('this promocode already exist')

        const createPromocode = await this.prisma.promoCode.create({
            data: {
                code: data.code,
                discount_percent: data.discount_percent,
                valid_from: data.valid_from,
                valid_to: data.valid_to,
                is_active: data.is_active
            }
        })
        return {
            data: createPromocode
        }
    }
    async getAllPromocode() {
        const data = await this.prisma.promoCode.findMany()
        return data
    }
    async getOnePromocode(id: string) {
        const existsPromocode = await this.prisma.promoCode.findUnique({ where: { id: id } })
        if (!existsPromocode) throw new NotFoundException('this promocode not found')

        const data = await this.prisma.promoCode.findUnique({ where: { id: id } })
        return data
    }
    async updatePromocode(id: string, data: UpdatePromoCodeDto) {
        const existsPromocode = await this.prisma.promoCode.findUnique({
            where: { id },
        });

        if (!existsPromocode) throw new NotFoundException('This promocode not found');

        if (data.code && data.code !== existsPromocode.code) {
            const existingCode = await this.prisma.promoCode.findUnique({
                where: { code: data.code },
            });
            if (existingCode)
                throw new ConflictException('This promocode already exists');
        }

        const updateData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );

        const updated = await this.prisma.promoCode.update({
            where: { id },
            data: {
                ...updateData,
                updated_at: new Date(),
            },
        });

        return updated;
    }

    async deletePromocode(id: string) {
        const existsPromocode = await this.prisma.promoCode.findUnique({ where: { id: id } })
        if (!existsPromocode) throw new NotFoundException('this promocode not found')

        await this.prisma.promoCode.delete({ where: { id: id } })
        return {
            message: 'successFully deleted'
        }

    }

}
