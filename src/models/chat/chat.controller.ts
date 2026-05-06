import {
    Body,
    Controller,
    Delete,
    Get,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gataway';
import {
    CreateChatDto,
    CreateSupportChatDto,
    GetAdminChatsDto,
    GetChatMessagesDto,
    GetUserChatsDto,
    MarkReadDto,
    SendMessageDto,
} from './dto/chat.dto';
import { Role } from 'src/common/decorators/role.decorator';
import { GuardService } from 'src/common/guard/guard.service';
import { RoleGuardService } from 'src/common/role_guard/role_guard.service';
import { Language } from 'src/utils/helper';
import { UserData } from 'src/common/decorators/auth.decorators';
import type { JwtPayload } from 'src/config/jwt/jwt.service';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(GuardService)
@Controller('chat')
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly chatGateway: ChatGateway,
    ) {}

    // ─── Chat yaratish ────────────────────────────────────────────────────────

    @Post('create')
    @ApiOperation({ summary: 'Order uchun chat yaratish yoki mavjudini olish' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'Chat yaratildi yoki mavjudi qaytarildi' })
    async createChat(@Body() dto: CreateChatDto, @UserData() req: JwtPayload) {
        return this.chatService.getOrCreateChatForOrder(dto, req.id);
    }

    @Post('support/create')
    @UseGuards(RoleGuardService)
    @Role('passenger', 'driver')
    @ApiOperation({ summary: 'Support chat yaratish yoki mavjudini olish' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'Support chat yaratildi yoki mavjudi qaytarildi' })
    async createSupportChat(@Body() dto: CreateSupportChatDto, @UserData() req: JwtPayload) {
        return this.chatService.getOrCreateSupportChat(dto, req.id);
    }

    // ─── Xabar yuborish ───────────────────────────────────────────────────────

    @Post('message/send')
    @ApiOperation({ summary: 'Text xabar yuborish (real-time broadcast bilan)' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Xabar saqlandi va barcha ishtirokchilarga real-time yuborildi',
    })
    async sendMessage(@Body() dto: SendMessageDto, @UserData() req: JwtPayload) {
        const message = await this.chatService.sendMessage(dto, req.id);
        // Socket orqali barcha chat ishtirokchilariga real-time yuborish
        this.chatGateway.emitNewMessage(dto.chat_id, message);
        return message;
    }

    // ─── Xabarni o'chirish ────────────────────────────────────────────────────

    @Delete('message/:messageId')
    @ApiOperation({ summary: 'Xabarni o\'chirish (faqat o\'z xabari)' })
    @ApiParam({ name: 'messageId', description: 'Message ID' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Xabar o\'chirildi' })
    async deleteMessage(@Param('messageId') messageId: string, @UserData() req: JwtPayload) {
        const result = await this.chatService.deleteMessage(messageId, req.id);
        this.chatGateway.emitMessageDeleted(result.chat_id, result.message_id);
        return result;
    }

    // ─── O'qilgan deb belgilash ───────────────────────────────────────────────

    @Patch('messages/read')
    @ApiOperation({ summary: 'Chatdagi xabarlarni o\'qilgan deb belgilash' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Xabarlar o\'qildi' })
    async markRead(@Body() dto: MarkReadDto, @UserData() req: JwtPayload) {
        const result = await this.chatService.markMessagesAsRead(dto.chat_id, req.id);
        this.chatGateway.emitMessagesRead(dto.chat_id, req.id);
        return result;
    }

    // ─── O'qilmagan xabarlar soni ─────────────────────────────────────────────

    @Get('unread-count')
    @ApiOperation({ summary: 'Barcha chatlardagi o\'qilmagan xabarlar soni' })
    @ApiResponse({
        status: HttpStatus.OK,
        schema: {
            example: {
                total_unread: 5,
                chats: [
                    { chat_id: 'uuid', unread_count: 3 },
                    { chat_id: 'uuid2', unread_count: 2 },
                ],
            },
        },
    })
    async getUnreadCount(@UserData() req: JwtPayload) {
        return this.chatService.getUnreadCount(req.id);
    }

    // ─── Xabarlar ro'yxati ────────────────────────────────────────────────────

    @Get('messages')
    @ApiOperation({ summary: 'Chat xabarlarini olish (pagination bilan)' })
    async getChatMessages(@Query() dto: GetChatMessagesDto, @UserData() req: JwtPayload) {
        return this.chatService.getChatMessages(dto, req.id);
    }

    // ─── Chatlar ro'yxati ─────────────────────────────────────────────────────

    @Get('list')
    @ApiOperation({ summary: 'Foydalanuvchining barcha chatlarini olish' })
    async getUserChats(@Query() dto: GetUserChatsDto, @UserData() req: JwtPayload) {
        return this.chatService.getUserChats(dto, req.id);
    }

    @Get('admin/list')
    @UseGuards(RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiOperation({ summary: 'Admin/Superadmin uchun barcha chatlarni kuzatish ro\'yxati' })
    async getAdminChats(@Query() dto: GetAdminChatsDto) {
        return this.chatService.getAdminChats(dto);
    }

    @Get('admin/messages')
    @UseGuards(RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiOperation({ summary: 'Admin/Superadmin uchun chat xabarlarini olish' })
    async getAdminChatMessages(@Query() dto: GetChatMessagesDto) {
        return this.chatService.getAdminChatMessages(dto);
    }

    @Get('admin/:chatId')
    @UseGuards(RoleGuardService)
    @Role('admin', 'superadmin')
    @ApiOperation({ summary: 'Admin/Superadmin uchun bitta chatni olish' })
    @ApiParam({ name: 'chatId', description: 'Chat ID' })
    @ApiQuery({ name: 'language', enum: Language, required: true, example: Language.uz })
    async getAdminChat(
        @Param('chatId') chatId: string,
        @Query('language') language: Language,
    ) {
        return this.chatService.getAdminChat(chatId, language);
    }

    // ─── Bitta chat ───────────────────────────────────────────────────────────

    @Get(':chatId')
    @ApiOperation({ summary: 'Bitta chatni olish' })
    @ApiParam({ name: 'chatId', description: 'Chat ID' })
    @ApiQuery({ name: 'language', enum: Language, required: true, example: Language.uz })
    async getChat(
        @Param('chatId') chatId: string,
        @Query('language') language: Language,
        @UserData() req: JwtPayload,
    ) {
        return this.chatService.getChat(chatId, req.id, language);
    }
}
