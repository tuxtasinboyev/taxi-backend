import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MessageType } from '@prisma/client';
import { DatabaseService } from 'src/config/database/database.service';
import { CreateChatDto, GetChatMessagesDto, GetUserChatsDto, SendMessageDto } from './dto/chat.dto';
import { Language } from 'src/utils/helper';


@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(private prisma: DatabaseService) { }

    /**
     * Order uchun chat yaratish yoki mavjudini qaytarish
     */
    async getOrCreateChatForOrder(createChatDto: CreateChatDto, userId: string) {
        // Orderni tekshirish
        const order = await this.prisma.order.findUnique({
            where: { id: createChatDto.order_id },
            include: {
                user: true,
                driver: true,
            },
        });

        if (!order) {
            throw new NotFoundException('Order topilmadi');
        }

        // Foydalanuvchi order egasi yoki driver ekanligini tekshirish
        if (order.user_id !== userId && order.driver_id !== userId) {
            throw new ForbiddenException('Bu orderga ruxsatingiz yo\'q');
        }

        // Agar driver hali tayinlanmagan bo'lsa
        if (!order.driver_id) {
            throw new BadRequestException('Driver hali tayinlanmagan, chat ochib bo\'lmaydi');
        }

        // Mavjud chatni qidirish
        let chat = await this.prisma.chat.findFirst({
            where: { order_id: createChatDto.order_id },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name_uz: true,
                                name_ru: true,
                                name_en: true,
                                profile_photo: true,
                                role: true,
                            },
                        },
                    },
                },
                messages: {
                    take: 1,
                    orderBy: { created_at: 'desc' },
                },
            },
        });

        // Agar chat mavjud bo'lmasa, yangi yaratish
        if (!chat) {
            const subjects = {
                uz: createChatDto.subject || 'Buyurtma chat',
                ru: 'Чат заказа',
                en: 'Order chat',
            };

            chat = await this.prisma.chat.create({
                data: {
                    order_id: createChatDto.order_id,
                    type: 'order',
                    subject_uz: subjects.uz,
                    subject_ru: subjects.ru,
                    subject_en: subjects.en,
                    participants: {
                        create: [
                            { user_id: order.user_id }, // Passenger
                            { user_id: order.driver_id }, // Driver
                        ],
                    },
                },
                include: {
                    participants: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name_uz: true,
                                    name_ru: true,
                                    name_en: true,
                                    profile_photo: true,
                                    role: true,
                                },
                            },
                        },
                    },
                    messages: true,
                },
            });

            this.logger.log(`✅ Yangi chat yaratildi: ${chat.id} (Order: ${order.id})`);
        }

        return this.formatChatResponse(chat, createChatDto.language);
    }

    /**
     * Text xabar yuborish
     */
    async sendMessage(sendMessageDto: SendMessageDto, userId: string) {
        // Chatni tekshirish
        const chat = await this.prisma.chat.findUnique({
            where: { id: sendMessageDto.chat_id },
            include: {
                participants: true,
                order: true,
            },
        });

        if (!chat) {
            throw new NotFoundException('Chat topilmadi');
        }

        // Foydalanuvchi chat ishtirokchisimi tekshirish
        const isParticipant = chat.participants.some(p => p.user_id === userId);
        if (!isParticipant) {
            throw new ForbiddenException('Bu chatga ruxsatingiz yo\'q');
        }

        // Xabarni saqlash (faqat text)
        const messageData: any = {
            chat_id: sendMessageDto.chat_id,
            sender_id: userId,
            message_type: MessageType.text,
        };

        // Tilga qarab saqlash
        if (sendMessageDto.language === Language.uz) {
            messageData.message_uz = sendMessageDto.message;
        } else if (sendMessageDto.language === Language.ru) {
            messageData.message_ru = sendMessageDto.message;
        } else if (sendMessageDto.language === Language.en) {
            messageData.message_en = sendMessageDto.message;
        }

        const message = await this.prisma.chatMessage.create({
            data: messageData,
            include: {
                sender: {
                    select: {
                        id: true,
                        name_uz: true,
                        name_ru: true,
                        name_en: true,
                        profile_photo: true,
                        role: true,
                    },
                },
            },
        });

        this.logger.log(`📨 Xabar yuborildi: ${message.id} (Chat: ${chat.id})`);

        return this.formatMessageResponse(message, sendMessageDto.language);
    }

    /**
     * Chat xabarlarini olish (pagination bilan)
     */
    async getChatMessages(getChatMessagesDto: GetChatMessagesDto, userId: string) {
        const { chat_id, language, page = 1, limit = 50 } = getChatMessagesDto;

        // Chatni tekshirish
        const chat = await this.prisma.chat.findUnique({
            where: { id: chat_id },
            include: {
                participants: true,
            },
        });

        if (!chat) {
            throw new NotFoundException('Chat topilmadi');
        }

        // Foydalanuvchi chat ishtirokchisimi tekshirish
        const isParticipant = chat.participants.some(p => p.user_id === userId);
        if (!isParticipant) {
            throw new ForbiddenException('Bu chatga ruxsatingiz yo\'q');
        }

        // Xabarlarni olish
        const skip = (page - 1) * limit;
        const messages = await this.prisma.chatMessage.findMany({
            where: { chat_id },
            include: {
                sender: {
                    select: {
                        id: true,
                        name_uz: true,
                        name_ru: true,
                        name_en: true,
                        profile_photo: true,
                        role: true,
                    },
                },
            },
            orderBy: { created_at: 'desc' },
            skip,
            take: limit,
        });

        const total = await this.prisma.chatMessage.count({ where: { chat_id } });

        return {
            messages: messages.map(m => this.formatMessageResponse(m, language)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Foydalanuvchining barcha chatlarini olish
     */
    async getUserChats(getUserChatsDto: GetUserChatsDto, userId: string) {
        const { language, page = 1, limit = 20 } = getUserChatsDto;
        const skip = (page - 1) * limit;

        // Foydalanuvchi ishtirok etgan chatlarni topish
        const chats = await this.prisma.chat.findMany({
            where: {
                participants: {
                    some: {
                        user_id: userId,
                    },
                },
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name_uz: true,
                                name_ru: true,
                                name_en: true,
                                profile_photo: true,
                                role: true,
                            },
                        },
                    },
                },
                messages: {
                    take: 1,
                    orderBy: { created_at: 'desc' },
                },
                order: {
                    select: {
                        id: true,
                        status: true,
                    },
                },
            },
            orderBy: { updated_at: 'desc' },
            skip,
            take: limit,
        });

        const total = await this.prisma.chat.count({
            where: {
                participants: {
                    some: {
                        user_id: userId,
                    },
                },
            },
        });

        return {
            chats: chats.map(chat => this.formatChatResponse(chat, language)),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Chatni olish (bitta)
     */
    async getChat(chatId: string, userId: string, language: Language) {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name_uz: true,
                                name_ru: true,
                                name_en: true,
                                profile_photo: true,
                                role: true,
                            },
                        },
                    },
                },
                messages: {
                    take: 1,
                    orderBy: { created_at: 'desc' },
                },
                order: {
                    select: {
                        id: true,
                        status: true,
                    },
                },
            },
        });

        if (!chat) {
            throw new NotFoundException('Chat topilmadi');
        }

        // Foydalanuvchi chat ishtirokchisimi tekshirish
        const isParticipant = chat.participants.some(p => p.user_id === userId);
        if (!isParticipant) {
            throw new ForbiddenException('Bu chatga ruxsatingiz yo\'q');
        }

        return this.formatChatResponse(chat, language);
    }

    // ================ HELPER FUNCTIONS ================

    private formatChatResponse(chat: any, language: Language) {
        const subjectKey = `subject_${language}` as keyof typeof chat;
        const lastMessage = chat.messages?.[0];

        // Boshqa ishtirokchini topish (o'zidan boshqasi)
        const otherParticipant = chat.participants.find(p => p.user_id !== chat.order?.user_id);

        return {
            id: chat.id,
            subject: chat[subjectKey] || chat.subject_uz,
            type: chat.type,
            order_id: chat.order_id,
            order_status: chat.order?.status,
            created_at: chat.created_at,
            updated_at: chat.updated_at,
            participants: chat.participants.map(p => ({
                id: p.user.id,
                name: p.user[`name_${language}`] || p.user.name_uz,
                profile_photo: p.user.profile_photo,
                role: p.user.role,
                joined_at: p.joined_at,
            })),
            last_message: lastMessage ? this.formatMessageResponse(lastMessage, language) : null,
            other_user: otherParticipant ? {
                id: otherParticipant.user.id,
                name: otherParticipant.user[`name_${language}`] || otherParticipant.user.name_uz,
                profile_photo: otherParticipant.user.profile_photo,
                role: otherParticipant.user.role,
            } : null,
        };
    }

    private formatMessageResponse(message: any, language: Language) {
        const messageKey = `message_${language}` as keyof typeof message;
        const messageContent = message[messageKey] || message.message_uz || message.message_ru || message.message_en;

        return {
            id: message.id,
            chat_id: message.chat_id,
            sender: {
                id: message.sender.id,
                name: message.sender[`name_${language}`] || message.sender.name_uz,
                profile_photo: message.sender.profile_photo,
                role: message.sender.role,
            },
            message: messageContent,
            message_type: MessageType.text,
            created_at: message.created_at,
            updated_at: message.updated_at,
        };
    }
}