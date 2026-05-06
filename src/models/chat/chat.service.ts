import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { MessageType, UserRole } from '@prisma/client';
import { DatabaseService } from 'src/config/database/database.service';
import {
    CreateChatDto,
    CreateSupportChatDto,
    GetAdminChatsDto,
    GetChatMessagesDto,
    GetUserChatsDto,
    SendMessageDto,
} from './dto/chat.dto';
import { Language } from 'src/utils/helper';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    private readonly userSelect = {
        id: true,
        name_uz: true,
        name_ru: true,
        name_en: true,
        profile_photo: true,
        role: true,
        phone: true,
        email: true,
    } as const;

    constructor(private prisma: DatabaseService) {}

    async getOrCreateChatForOrder(createChatDto: CreateChatDto, userId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: createChatDto.order_id },
            include: { user: true, driver: true },
        });

        if (!order) throw new NotFoundException('Order topilmadi');

        if (order.user_id !== userId && order.driver_id !== userId) {
            throw new ForbiddenException("Bu orderga ruxsatingiz yo'q");
        }

        if (!order.driver_id) {
            throw new BadRequestException("Driver hali tayinlanmagan, chat ochib bo'lmaydi");
        }

        let chat = await this.prisma.chat.findFirst({
            where: { order_id: createChatDto.order_id },
            include: this.buildChatInclude(),
        });

        if (!chat) {
            chat = await this.prisma.chat.create({
                data: {
                    order_id: createChatDto.order_id,
                    type: 'order',
                    subject_uz: createChatDto.subject || 'Buyurtma chat',
                    subject_ru: 'Чат заказа',
                    subject_en: 'Order chat',
                    participants: {
                        create: [
                            { user_id: order.user_id },
                            { user_id: order.driver_id },
                        ],
                    },
                },
                include: this.buildChatInclude(),
            });

            this.logger.log(`Yangi order chat yaratildi: ${chat.id}`);
        }

        return this.formatChatResponse(chat, createChatDto.language, userId);
    }

    async getOrCreateSupportChat(createSupportChatDto: CreateSupportChatDto, userId: string) {
        let chat = await this.prisma.chat.findFirst({
            where: {
                type: 'support',
                order_id: null,
                participants: {
                    some: { user_id: userId },
                },
            },
            include: this.buildChatInclude(),
        });

        if (!chat) {
            chat = await this.prisma.chat.create({
                data: {
                    type: 'support',
                    subject_uz: createSupportChatDto.subject || 'Qo‘llab-quvvatlash',
                    subject_ru: createSupportChatDto.subject || 'Поддержка',
                    subject_en: createSupportChatDto.subject || 'Support',
                    participants: {
                        create: [{ user_id: userId }],
                    },
                },
                include: this.buildChatInclude(),
            });

            this.logger.log(`Yangi support chat yaratildi: ${chat.id}`);
        }

        return this.formatChatResponse(chat, createSupportChatDto.language, userId);
    }

    async sendMessage(sendMessageDto: SendMessageDto, userId: string) {
        await this.ensureChatWritable(sendMessageDto.chat_id, userId);

        const messageData: any = {
            chat_id: sendMessageDto.chat_id,
            sender_id: userId,
            message_type: MessageType.text,
        };

        if (sendMessageDto.language === Language.uz) messageData.message_uz = sendMessageDto.message;
        else if (sendMessageDto.language === Language.ru) messageData.message_ru = sendMessageDto.message;
        else messageData.message_en = sendMessageDto.message;

        const message = await this.prisma.chatMessage.create({
            data: messageData,
            include: {
                sender: {
                    select: this.userSelect,
                },
            },
        });

        await this.prisma.chat.update({
            where: { id: sendMessageDto.chat_id },
            data: { updated_at: new Date() },
        });

        this.logger.log(`Xabar yuborildi: ${message.id}`);
        return this.formatMessageResponse(message, sendMessageDto.language);
    }

    async isPrivilegedUser(userId: string) {
        const role = await this.getUserRole(userId);
        return this.isPrivilegedRole(role);
    }

    async getChatMeta(chatId: string) {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            include: {
                order: {
                    select: {
                        status: true,
                    },
                },
            },
        });

        if (!chat) throw new NotFoundException('Chat topilmadi');

        return {
            id: chat.id,
            type: chat.type,
            order_id: chat.order_id,
            order_status: chat.order?.status ?? null,
        };
    }

    async markMessagesAsRead(chatId: string, userId: string) {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            include: { participants: true },
        });

        if (!chat) throw new NotFoundException('Chat topilmadi');

        const isParticipant = chat.participants.some((p) => p.user_id === userId);
        if (!isParticipant) throw new ForbiddenException("Bu chatga ruxsatingiz yo'q");

        const result = await this.prisma.chatMessage.updateMany({
            where: {
                chat_id: chatId,
                sender_id: { not: userId },
                is_read: false,
            },
            data: {
                is_read: true,
                read_at: new Date(),
            },
        });

        return { success: true, chat_id: chatId, updated_count: result.count };
    }

    async deleteMessage(messageId: string, userId: string) {
        const message = await this.prisma.chatMessage.findUnique({
            where: { id: messageId },
        });

        if (!message) throw new NotFoundException('Xabar topilmadi');
        if (message.sender_id !== userId) throw new ForbiddenException("Faqat o'z xabaringizni o'chira olasiz");

        await this.prisma.chatMessage.delete({ where: { id: messageId } });

        return { success: true, message_id: messageId, chat_id: message.chat_id };
    }

    async getUnreadCount(userId: string) {
        const participations = await this.prisma.chatParticipant.findMany({
            where: { user_id: userId },
            select: { chat_id: true },
        });

        const counts = await Promise.all(
            participations.map(async ({ chat_id }) => {
                const count = await this.prisma.chatMessage.count({
                    where: { chat_id, sender_id: { not: userId }, is_read: false },
                });
                return { chat_id, unread_count: count };
            }),
        );

        const total = counts.reduce((sum, c) => sum + c.unread_count, 0);
        return { total_unread: total, chats: counts };
    }

    async getUserChatIds(userId: string): Promise<string[]> {
        const participations = await this.prisma.chatParticipant.findMany({
            where: { user_id: userId },
            select: { chat_id: true },
        });
        return participations.map((p) => p.chat_id);
    }

    async getChatMessages(getChatMessagesDto: GetChatMessagesDto, userId: string) {
        const { chat_id, language, page = 1, limit = 50 } = getChatMessagesDto;

        const chat = await this.prisma.chat.findUnique({
            where: { id: chat_id },
            include: { participants: true },
        });

        if (!chat) throw new NotFoundException('Chat topilmadi');

        const isParticipant = chat.participants.some((p) => p.user_id === userId);
        if (!isParticipant) throw new ForbiddenException("Bu chatga ruxsatingiz yo'q");

        return this.buildChatMessagesResponse(chat_id, language, Number(page), Number(limit));
    }

    async getUserChats(getUserChatsDto: GetUserChatsDto, userId: string) {
        const { language, page = 1, limit = 20 } = getUserChatsDto;
        const skip = (Number(page) - 1) * Number(limit);

        const chats = await this.prisma.chat.findMany({
            where: { participants: { some: { user_id: userId } } },
            include: this.buildChatInclude(),
            orderBy: { updated_at: 'desc' },
            skip,
            take: Number(limit),
        });

        const total = await this.prisma.chat.count({
            where: { participants: { some: { user_id: userId } } },
        });

        const chatsWithUnread = await Promise.all(
            chats.map(async (chat) => {
                const unread = await this.prisma.chatMessage.count({
                    where: { chat_id: chat.id, sender_id: { not: userId }, is_read: false },
                });
                return {
                    ...this.formatChatResponse(chat, language, userId),
                    unread_count: unread,
                };
            }),
        );

        return {
            chats: chatsWithUnread,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    }

    async getAdminChats(getAdminChatsDto: GetAdminChatsDto) {
        const { language, page = 1, limit = 20, type, search, user_id, order_id } = getAdminChatsDto;
        const skip = (Number(page) - 1) * Number(limit);

        const where: Record<string, unknown> = {};

        if (type) where.type = type;
        if (order_id) where.order_id = order_id;
        if (user_id) {
            where.participants = {
                some: { user_id },
            };
        }

        if (search) {
            where.AND = [
                {
                    OR: [
                        { subject_uz: { contains: search, mode: 'insensitive' } },
                        { subject_ru: { contains: search, mode: 'insensitive' } },
                        { subject_en: { contains: search, mode: 'insensitive' } },
                        {
                            participants: {
                                some: {
                                    user: {
                                        OR: [
                                            { name_uz: { contains: search, mode: 'insensitive' } },
                                            { name_ru: { contains: search, mode: 'insensitive' } },
                                            { name_en: { contains: search, mode: 'insensitive' } },
                                            { phone: { contains: search, mode: 'insensitive' } },
                                            { email: { contains: search, mode: 'insensitive' } },
                                        ],
                                    },
                                },
                            },
                        },
                    ],
                },
            ];
        }

        const chats = await this.prisma.chat.findMany({
            where,
            include: this.buildChatInclude(),
            orderBy: { updated_at: 'desc' },
            skip,
            take: Number(limit),
        });

        const total = await this.prisma.chat.count({ where });

        return {
            chats: chats.map((chat) => this.formatChatResponse(chat, language)),
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    }

    async getAdminChatMessages(getChatMessagesDto: GetChatMessagesDto) {
        const { chat_id, language, page = 1, limit = 50 } = getChatMessagesDto;

        const chat = await this.prisma.chat.findUnique({
            where: { id: chat_id },
            select: { id: true },
        });

        if (!chat) throw new NotFoundException('Chat topilmadi');

        return this.buildChatMessagesResponse(chat_id, language, Number(page), Number(limit));
    }

    async getChat(chatId: string, userId: string, language: Language) {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            include: this.buildChatInclude(),
        });

        if (!chat) throw new NotFoundException('Chat topilmadi');

        const isParticipant = chat.participants.some((p) => p.user_id === userId);
        if (!isParticipant) throw new ForbiddenException("Bu chatga ruxsatingiz yo'q");

        return this.formatChatResponse(chat, language, userId);
    }

    async getAdminChat(chatId: string, language: Language) {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            include: this.buildChatInclude(),
        });

        if (!chat) throw new NotFoundException('Chat topilmadi');

        return this.formatChatResponse(chat, language);
    }

    private async ensureChatWritable(chatId: string, userId: string) {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            include: { participants: true },
        });

        if (!chat) throw new NotFoundException('Chat topilmadi');

        const isParticipant = chat.participants.some((p) => p.user_id === userId);
        if (isParticipant) return chat;

        const role = await this.getUserRole(userId);

        if (this.isPrivilegedRole(role) && chat.type === 'support') {
            await this.prisma.chatParticipant.create({
                data: {
                    chat_id: chatId,
                    user_id: userId,
                },
            });

            return this.prisma.chat.findUnique({
                where: { id: chatId },
                include: { participants: true },
            });
        }

        throw new ForbiddenException("Bu chatga xabar yuborishga ruxsatingiz yo'q");
    }

    private async getUserRole(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (!user) throw new NotFoundException('User topilmadi');
        return user.role;
    }

    private isPrivilegedRole(role: UserRole) {
        return role === UserRole.admin || role === UserRole.superadmin;
    }

    private buildChatInclude() {
        return {
            participants: {
                include: {
                    user: {
                        select: this.userSelect,
                    },
                },
            },
            messages: {
                take: 1,
                orderBy: { created_at: 'desc' as const },
                include: {
                    sender: {
                        select: this.userSelect,
                    },
                },
            },
            order: {
                select: {
                    id: true,
                    status: true,
                    user_id: true,
                    driver_id: true,
                },
            },
        };
    }

    private async buildChatMessagesResponse(
        chatId: string,
        language: Language,
        page: number,
        limit: number,
    ) {
        const skip = (page - 1) * limit;

        const messages = await this.prisma.chatMessage.findMany({
            where: { chat_id: chatId },
            include: {
                sender: {
                    select: this.userSelect,
                },
            },
            orderBy: { created_at: 'desc' },
            skip,
            take: limit,
        });

        const total = await this.prisma.chatMessage.count({ where: { chat_id: chatId } });

        return {
            messages: messages.map((message) => this.formatMessageResponse(message, language)),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    formatChatResponse(chat: any, language: Language, currentUserId?: string) {
        const subjectKey = `subject_${language}`;
        const lastMessage = chat.messages?.[0];

        let otherParticipant: any = null;
        if (currentUserId) {
            otherParticipant = chat.participants.find((p: any) => p.user_id !== currentUserId) || null;
        } else {
            otherParticipant =
                chat.participants.find((p: any) => !this.isPrivilegedRole(p.user.role)) ||
                chat.participants[0] ||
                null;
        }

        return {
            id: chat.id,
            subject: chat[subjectKey] || chat.subject_uz,
            type: chat.type,
            order_id: chat.order_id,
            order_status: chat.order?.status,
            created_at: chat.created_at,
            updated_at: chat.updated_at,
            participants: chat.participants.map((p: any) => ({
                id: p.user.id,
                name: p.user[`name_${language}`] || p.user.name_uz,
                phone: p.user.phone,
                email: p.user.email,
                profile_photo: p.user.profile_photo,
                role: p.user.role,
                joined_at: p.joined_at,
            })),
            last_message: lastMessage ? this.formatMessageResponse(lastMessage, language) : null,
            other_user: otherParticipant
                ? {
                      id: otherParticipant.user.id,
                      name: otherParticipant.user[`name_${language}`] || otherParticipant.user.name_uz,
                      phone: otherParticipant.user.phone,
                      email: otherParticipant.user.email,
                      profile_photo: otherParticipant.user.profile_photo,
                      role: otherParticipant.user.role,
                  }
                : null,
        };
    }

    formatMessageResponse(message: any, language: Language) {
        const content =
            message[`message_${language}`] ||
            message.message_uz ||
            message.message_ru ||
            message.message_en;

        return {
            id: message.id,
            chat_id: message.chat_id,
            sender: message.sender
                ? {
                      id: message.sender.id,
                      name: message.sender[`name_${language}`] || message.sender.name_uz,
                      phone: message.sender.phone,
                      email: message.sender.email,
                      profile_photo: message.sender.profile_photo,
                      role: message.sender.role,
                  }
                : null,
            message: content,
            message_type: message.message_type,
            is_read: message.is_read,
            read_at: message.read_at,
            created_at: message.created_at,
            updated_at: message.updated_at,
        };
    }
}
