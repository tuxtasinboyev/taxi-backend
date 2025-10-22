import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/config/database/database.service';
import { CreatePromoCodeDto } from './dto/create.promocode.dto';

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
    async updatePromocode(id: string, data: Partial<CreatePromoCodeDto>) {

        const existsPromocode = await this.prisma.promoCode.findUnique({ where: { id: id } })
        if (!existsPromocode) throw new NotFoundException('this promocode not found')

        if (data.code) {
            const existsPromocode = await this.prisma.promoCode.findUnique({ where: { id: data.code } })
            if (existsPromocode) throw new NotFoundException('this promocode already exists')
        }
        const updated = await this.prisma.promoCode.update({
            where: { id: id },
            data: {
                code: data.code,
                discount_percent: data.discount_percent,
                is_active: data.is_active,
                updated_at: new Date(),
                valid_from: data.valid_from,
                valid_to: data.valid_to
            }
        })
        return updated

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
