import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { MessageType } from '@prisma/client';
import { Language } from 'src/utils/helper';
export class CreateChatDto {
    @ApiProperty({ description: 'Order ID for chat', example: 'uuid-string' })
    @IsNotEmpty()
    @IsUUID()
    order_id: string;

    @ApiProperty({
        enum: Language,
        description: 'User language',
        example: Language.uz,
        default: Language.uz
    })
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

    @ApiProperty({
        enum: Language,
        description: 'Message language',
        example: Language.uz
    })
    @IsEnum(Language)
    language: Language;
}

export class GetChatMessagesDto {
    @ApiProperty({ description: 'Chat ID', example: 'uuid-string' })
    @IsNotEmpty()
    @IsUUID()
    chat_id: string;

    @ApiProperty({
        enum: Language,
        description: 'User language',
        example: Language.uz
    })
    @IsEnum(Language)
    language: Language;

    @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
    @IsOptional()
    page?: number;

    @ApiPropertyOptional({ description: 'Items per page', example: 50, default: 50 })
    @IsOptional()
    limit?: number;
}

export class TypingDto {
    @ApiProperty({ description: 'Chat ID', example: 'uuid-string' })
    @IsNotEmpty()
    @IsUUID()
    chat_id: string;

    @ApiProperty({ description: 'Is typing', example: true })
    @IsNotEmpty()
    is_typing: boolean;
}

export class GetUserChatsDto {
    @ApiProperty({
        enum: Language,
        description: 'User language',
        example: Language.uz
    })
    @IsEnum(Language)
    language: Language;

    @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
    @IsOptional()
    page?: number;

    @ApiPropertyOptional({ description: 'Items per page', example: 20, default: 20 })
    @IsOptional()
    limit?: number;
}

// Socket event payloads
export class SocketJoinChatDto {
    chat_id: string;
    user_id: string;
    device_id: string;
}

export class SocketMessageDto {
    chat_id: string;
    sender_id: string;
    message: string;
    language: Language;
}

export class SocketTypingDto {
    chat_id: string;
    user_id: string;
    is_typing: boolean;
    language: Language;
}