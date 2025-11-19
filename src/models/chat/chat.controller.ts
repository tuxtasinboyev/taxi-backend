import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
    CreateChatDto,
    SendMessageDto,
    GetChatMessagesDto,
    GetUserChatsDto,
} from './dto/chat.dto';
import { GuardService } from 'src/common/guard/guard.service';
import { Language } from 'src/utils/helper';
import { UserData } from 'src/common/decorators/auth.decorators';
import type { JwtPayload } from 'src/config/jwt/jwt.service';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(GuardService)
@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Post('create')
    @ApiOperation({
        summary: 'Order uchun chat yaratish yoki mavjudini olish',
        description: 'Passenger va driver o\'rtasida order uchun chat yaratadi'
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Chat muvaffaqiyatli yaratildi yoki mavjud chat qaytarildi',
        schema: {
            example: {
                id: 'uuid-string',
                subject: 'Buyurtma chat',
                type: 'order',
                order_id: 'uuid-string',
                order_status: 'accepted',
                participants: [
                    {
                        id: 'uuid-string',
                        name: 'Aziz',
                        profile_photo: 'https://example.com/photo.jpg',
                        role: 'passenger',
                        joined_at: '2025-01-15T10:00:00Z',
                    },
                ],
                last_message: null,
                other_user: {
                    id: 'uuid-string',
                    name: 'Sardor',
                    profile_photo: 'https://example.com/photo2.jpg',
                    role: 'driver',
                },
                created_at: '2025-01-15T10:00:00Z',
                updated_at: '2025-01-15T10:00:00Z',
            },
        },
    })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Order topilmadi' })
    @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Ruxsat yo\'q' })
    @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Driver hali tayinlanmagan' })
    async createChat(@Body() createChatDto: CreateChatDto, @UserData() req:JwtPayload) {
        return this.chatService.getOrCreateChatForOrder(createChatDto, req.id);
    }

    @Post('message/send')
    @ApiOperation({
        summary: 'Text xabar yuborish',
        description: 'Chatga faqat text xabar yuboradi'
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Xabar muvaffaqiyatli yuborildi',
        schema: {
            example: {
                id: 'uuid-string',
                chat_id: 'uuid-string',
                sender: {
                    id: 'uuid-string',
                    name: 'Aziz',
                    profile_photo: 'https://example.com/photo.jpg',
                    role: 'passenger',
                },
                message: 'Salom, 5 daqiqada yetib boraman',
                message_type: 'text',
                created_at: '2025-01-15T10:05:00Z',
                updated_at: '2025-01-15T10:05:00Z',
            },
        },
    })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Chat topilmadi' })
    @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Ruxsat yo\'q' })
    async sendMessage(@Body() sendMessageDto: SendMessageDto, @UserData() req: JwtPayload) {
        return this.chatService.sendMessage(sendMessageDto, req.id);
    }

    @Get('messages')
    @ApiOperation({
        summary: 'Chat xabarlarini olish',
        description: 'Berilgan chatning barcha xabarlarini pagination bilan qaytaradi'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Xabarlar ro\'yxati',
        schema: {
            example: {
                messages: [
                    {
                        id: 'uuid-string',
                        chat_id: 'uuid-string',
                        sender: {
                            id: 'uuid-string',
                            name: 'Aziz',
                            profile_photo: 'https://example.com/photo.jpg',
                            role: 'passenger',
                        },
                        message: 'Salom',
                        message_type: 'text',
                        created_at: '2025-01-15T10:00:00Z',
                        updated_at: '2025-01-15T10:00:00Z',
                    },
                ],
                pagination: {
                    page: 1,
                    limit: 50,
                    total: 10,
                    totalPages: 1,
                },
            },
        },
    })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Chat topilmadi' })
    @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Ruxsat yo\'q' })
    async getChatMessages(@Query() getChatMessagesDto: GetChatMessagesDto, @UserData() req: JwtPayload) {
        return this.chatService.getChatMessages(getChatMessagesDto, req.id);
    }

    @Get('list')
    @ApiOperation({
        summary: 'Foydalanuvchining barcha chatlarini olish',
        description: 'Foydalanuvchi ishtirok etgan barcha chatlar ro\'yxati'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Chatlar ro\'yxati',
        schema: {
            example: {
                chats: [
                    {
                        id: 'uuid-string',
                        subject: 'Buyurtma chat',
                        type: 'order',
                        order_id: 'uuid-string',
                        order_status: 'completed',
                        participants: [
                            {
                                id: 'uuid-string',
                                name: 'Aziz',
                                profile_photo: 'https://example.com/photo.jpg',
                                role: 'passenger',
                                joined_at: '2025-01-15T10:00:00Z',
                            },
                        ],
                        last_message: {
                            id: 'uuid-string',
                            message: 'Rahmat',
                            message_type: 'text',
                            created_at: '2025-01-15T11:00:00Z',
                        },
                        other_user: {
                            id: 'uuid-string',
                            name: 'Sardor',
                            profile_photo: 'https://example.com/photo2.jpg',
                            role: 'driver',
                        },
                        created_at: '2025-01-15T10:00:00Z',
                        updated_at: '2025-01-15T11:00:00Z',
                    },
                ],
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 5,
                    totalPages: 1,
                },
            },
        },
    })
    async getUserChats(@Query() getUserChatsDto: GetUserChatsDto, @UserData() req: JwtPayload) {
        return this.chatService.getUserChats(getUserChatsDto, req.id);
    }

    @Get(':chatId')
    @ApiOperation({
        summary: 'Bitta chatni olish',
        description: 'Chat ID orqali to\'liq ma\'lumotlarni qaytaradi'
    })
    @ApiParam({ name: 'chatId', description: 'Chat ID', type: String })
    @ApiQuery({
        name: 'language',
        enum: Language,
        description: 'Til',
        required: true,
        example: Language.uz
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Chat ma\'lumotlari',
    })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Chat topilmadi' })
    @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Ruxsat yo\'q' })
    async getChat(
        @Param('chatId') chatId: string,
        @Query('language') language: Language,
        @UserData() req: JwtPayload
    ) {
        return this.chatService.getChat(chatId, req.id, language);
    }
}