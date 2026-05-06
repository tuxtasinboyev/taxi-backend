import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { Language } from 'src/utils/helper';

export class CreateChatDto {
    @ApiProperty({ description: 'Order ID for chat', example: 'uuid-string' })
    @IsNotEmpty()
    @IsUUID()
    order_id: string;

    @ApiProperty({ enum: Language, example: Language.uz, default: Language.uz })
    @IsEnum(Language)
    language: Language;

    @ApiPropertyOptional({ description: 'Chat subject' })
    @IsOptional()
    @IsString()
    subject?: string;
}

export class SendMessageDto {
    @ApiProperty({ description: 'Chat ID', example: 'uuid-string' })
    @IsNotEmpty()
    @IsUUID()
    chat_id: string;

    @ApiProperty({ description: 'Message text' })
    @IsNotEmpty()
    @IsString()
    message: string;

    @ApiProperty({ enum: Language, example: Language.uz })
    @IsEnum(Language)
    language: Language;
}

export class CreateSupportChatDto {
    @ApiProperty({ enum: Language, example: Language.uz, default: Language.uz })
    @IsEnum(Language)
    language: Language;

    @ApiPropertyOptional({ description: 'Support chat subject' })
    @IsOptional()
    @IsString()
    subject?: string;
}

export class GetChatMessagesDto {
    @ApiProperty({ description: 'Chat ID', example: 'uuid-string' })
    @IsNotEmpty()
    @IsUUID()
    chat_id: string;

    @ApiProperty({ enum: Language, example: Language.uz })
    @IsEnum(Language)
    language: Language;

    @ApiPropertyOptional({ example: 1, default: 1 })
    @IsOptional()
    page?: number;

    @ApiPropertyOptional({ example: 50, default: 50 })
    @IsOptional()
    limit?: number;
}

export class MarkReadDto {
    @ApiProperty({ description: 'Chat ID', example: 'uuid-string' })
    @IsNotEmpty()
    @IsUUID()
    chat_id: string;

    @ApiProperty({ enum: Language, example: Language.uz })
    @IsEnum(Language)
    language: Language;
}

export class TypingDto {
    @ApiProperty({ description: 'Chat ID', example: 'uuid-string' })
    @IsNotEmpty()
    @IsUUID()
    chat_id: string;

    @ApiProperty({ example: true })
    @IsNotEmpty()
    is_typing: boolean;
}

export class GetUserChatsDto {
    @ApiProperty({ enum: Language, example: Language.uz })
    @IsEnum(Language)
    language: Language;

    @ApiPropertyOptional({ example: 1, default: 1 })
    @IsOptional()
    page?: number;

    @ApiPropertyOptional({ example: 20, default: 20 })
    @IsOptional()
    limit?: number;
}

export class GetAdminChatsDto {
    @ApiProperty({ enum: Language, example: Language.uz })
    @IsEnum(Language)
    language: Language;

    @ApiPropertyOptional({ example: 1, default: 1 })
    @IsOptional()
    page?: number;

    @ApiPropertyOptional({ example: 20, default: 20 })
    @IsOptional()
    limit?: number;

    @ApiPropertyOptional({ example: 'support', description: 'Chat type filter: support yoki order' })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional({ example: 'Ali', description: 'Search by subject, user name, phone, email' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ example: 'uuid-string', description: 'Filter by user id' })
    @IsOptional()
    @IsUUID()
    user_id?: string;

    @ApiPropertyOptional({ example: 'uuid-string', description: 'Filter by order id' })
    @IsOptional()
    @IsUUID()
    order_id?: string;
}

// Socket event payloads
export class SocketJoinChatDto {
    chat_id: string;
    user_id: string;
    device_id: string;
}

export class SocketMessageDto {
    chat_id: string;
    message: string;
    language: Language;
}

export class SocketTypingDto {
    chat_id: string;
    is_typing: boolean;
}
