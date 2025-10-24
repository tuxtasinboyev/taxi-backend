import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class CreatePaymentDto {
    @ApiProperty({
        description: 'Buyurtma ID (Order bilan bog‘lanadi)',
        example: 'a3f7d470-85b6-4c3e-b4a4-1a8ad2b9b7e1',
    })
    @IsNotEmpty()
    order_id: string;

    @ApiProperty({
        description: 'To‘lov summasi (so‘mda yoki USDda, loyihangizga qarab)',
        example: 120000.50,
    })
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsNotEmpty()
    amount: number;

    @ApiProperty({
        description: 'To‘lov turi',
        enum: PaymentMethod,
        example: PaymentMethod.payme,
        required: false,
    })
    @IsEnum(PaymentMethod)
    @IsOptional()
    method?: PaymentMethod;

    @ApiProperty({
        description: 'To‘lov holati (odatda avtomatik o‘rnatiladi)',
        enum: PaymentStatus,
        example: PaymentStatus.pending,
        required: false,
    })
    @IsEnum(PaymentStatus)
    @IsOptional()
    status?: PaymentStatus;

   
}
