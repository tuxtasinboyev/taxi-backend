import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SessionManager } from 'src/core/sesions/sesions.service';
import { ChatService } from './chat.service';
import { SocketMessageDto, SocketTypingDto } from './dto/chat.dto';
import { Language } from 'src/utils/helper';

@WebSocketGateway({
    cors: {
        origin: '*', // Production uchun o'zgartiring
        credentials: true,
    },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private readonly sessionManager: SessionManager,
        private readonly chatService: ChatService,
    ) { }

    afterInit() {
        this.sessionManager.setServer(this.server);
        this.logger.log('🚀 Chat Gateway initialized');
    }

    /**
     * Client ulanganda
     */
    async handleConnection(client: Socket) {
        try {
            const userId = client.handshake.auth.userId || client.handshake.query.userId;
            const deviceId = client.handshake.auth.deviceId || client.handshake.query.deviceId || 'default';

            if (!userId) {
                this.logger.warn(`❌ Unauthorized connection attempt: ${client.id}`);
                client.disconnect();
                return;
            }

            // Session manager orqali ulanishni ro'yxatga olish
            this.sessionManager.registerConnection(userId as string, deviceId as string, client.id);

            // Clientga ulanish tasdiqlash
            client.emit('connected', {
                message: 'Chat serverga muvaffaqiyatli ulandi',
                userId,
                deviceId,
                socketId: client.id,
            });

            this.logger.log(`✅ Client connected: ${userId} (${deviceId}) -> ${client.id}`);
        } catch (error) {
            this.logger.error('Connection error:', error);
            client.disconnect();
        }
    }

    /**
     * Client uzilganda
     */
    handleDisconnect(client: Socket) {
        const userId = client.handshake.auth.userId || client.handshake.query.userId;
        const deviceId = client.handshake.auth.deviceId || client.handshake.query.deviceId || 'default';

        if (userId) {
            this.sessionManager.unregisterConnection(userId as string, deviceId as string, client.id);
            this.logger.log(`❌ Client disconnected: ${userId} (${deviceId}) -> ${client.id}`);
        }
    }

    /**
     * Chatga qo'shilish (room join)
     */
    @SubscribeMessage('join_chat')
    async handleJoinChat(
        @MessageBody() data: { chat_id: string; user_id: string; device_id?: string },
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const { chat_id, user_id, device_id = 'default' } = data;

            // Chatni tekshirish va ruxsat
            const language = (client.handshake.query.language as Language) || Language.uz;
            const chat = await this.chatService.getChat(chat_id, user_id, language);

            // Foydalanuvchini chat room ga qo'shish
            this.sessionManager.joinRoom(user_id, device_id, `chat:${chat_id}`);

            client.emit('joined_chat', {
                success: true,
                chat_id,
                message: 'Chatga muvaffaqiyatli qo\'shildingiz',
                chat_info: chat,
            });

            // Boshqa ishtirokchilarga xabar berish
            this.sessionManager.emitToRoom(`chat:${chat_id}`, 'user_joined', {
                user_id,
                chat_id,
                timestamp: new Date(),
            });

            this.logger.log(`👥 User ${user_id} joined chat ${chat_id}`);
        } catch (error) {
            this.logger.error('Join chat error:', error);
            client.emit('error', {
                event: 'join_chat',
                message: error.message,
            });
        }
    }

    /**
     * Chatdan chiqish
     */
    @SubscribeMessage('leave_chat')
    async handleLeaveChat(
        @MessageBody() data: { chat_id: string; user_id: string; device_id?: string },
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const { chat_id, user_id, device_id = 'default' } = data;

            this.sessionManager.leaveRoom(user_id, device_id, `chat:${chat_id}`);

            client.emit('left_chat', {
                success: true,
                chat_id,
                message: 'Chatdan chiqdingiz',
            });

            // Boshqa ishtirokchilarga xabar berish
            this.sessionManager.emitToRoom(`chat:${chat_id}`, 'user_left', {
                user_id,
                chat_id,
                timestamp: new Date(),
            });

            this.logger.log(`👤 User ${user_id} left chat ${chat_id}`);
        } catch (error) {
            this.logger.error('Leave chat error:', error);
            client.emit('error', {
                event: 'leave_chat',
                message: error.message,
            });
        }
    }

    /**
     * Real-time text xabar yuborish
     */
    @SubscribeMessage('send_message')
    async handleSendMessage(
        @MessageBody() data: SocketMessageDto,
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const { chat_id, sender_id, message, language } = data;

            // Faqat text xabar yuborish
            const savedMessage = await this.chatService.sendMessage(
                {
                    chat_id,
                    message,
                    language,
                },
                sender_id,
            );

            // Chat room ga xabar yuborish (barcha ishtirokchilarga)
            this.sessionManager.emitToRoom(`chat:${chat_id}`, 'new_message', savedMessage);

            // Jo'natuvchiga tasdiqlash
            client.emit('message_sent', {
                success: true,
                message: savedMessage,
            });

            this.logger.log(`📨 Message sent in chat ${chat_id} by user ${sender_id}`);
        } catch (error) {
            this.logger.error('Send message error:', error);
            client.emit('error', {
                event: 'send_message',
                message: error.message,
            });
        }
    }

    /**
     * Typing indicator (yozish jarayonini ko'rsatish)
     */
    @SubscribeMessage('typing')
    handleTyping(
        @MessageBody() data: SocketTypingDto,
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const { chat_id, user_id, is_typing } = data;

            // Boshqa ishtirokchilarga typing xabarini yuborish
            this.server.to(`chat:${chat_id}`).except(client.id).emit('user_typing', {
                chat_id,
                user_id,
                is_typing,
                timestamp: new Date(),
            });

            this.logger.debug(`⌨️  User ${user_id} is ${is_typing ? 'typing' : 'stopped typing'} in chat ${chat_id}`);
        } catch (error) {
            this.logger.error('Typing indicator error:', error);
        }
    }

    /**
     * Online foydalanuvchilar ro'yxati
     */
    @SubscribeMessage('get_online_users')
    handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
        const onlineUsers = this.sessionManager.getAllOnlineUsers();
        client.emit('online_users', {
            users: onlineUsers,
            count: onlineUsers.length,
        });
    }
}