import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AcceptOrderDto {
    @ApiProperty({ example: 'uuid-driver', description: 'Haydovchi IDsi' })
    @IsString()
    driverId: string;

    @ApiProperty({ example: 'uuid-order', description: 'Order IDsi' })
    @IsString()
    orderId: string;
}
