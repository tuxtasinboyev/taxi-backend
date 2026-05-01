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
    cors: { origin: '*', credentials: true },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private readonly sessionManager: SessionManager,
        private readonly chatService: ChatService,
    ) {}

    afterInit() {
        this.sessionManager.setServer(this.server);
        this.logger.log('🚀 Chat Gateway initialized');
    }

    async handleConnection(client: Socket) {
        try {
            const userId = client.handshake.auth.userId || client.handshake.query.userId as string;
            const deviceId = (client.handshake.auth.deviceId || client.handshake.query.deviceId || 'default') as string;

            if (!userId) {
                client.emit('error', { message: 'userId talab qilinadi' });
                client.disconnect();
                return;
            }

            this.sessionManager.registerConnection(userId, deviceId, client.id);

            // Foydalanuvchi ishtirok etayotgan barcha chatlarga avtomatik qo'shish
            const chatIds = await this.chatService.getUserChatIds(userId);
            chatIds.forEach(chatId => client.join(`chat:${chatId}`));

            client.emit('connected', {
                message: 'Chat serverga ulandi',
                userId,
                socketId: client.id,
                joined_chats: chatIds.length,
            });

            this.logger.log(`✅ User ${userId} connected, joined ${chatIds.length} chats`);
        } catch (error) {
            this.logger.error('Connection error:', error);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.handshake.auth.userId || client.handshake.query.userId as string;
        const deviceId = (client.handshake.auth.deviceId || client.handshake.query.deviceId || 'default') as string;

        if (userId) {
            this.sessionManager.unregisterConnection(userId, deviceId, client.id);
            this.logger.log(`❌ User ${userId} disconnected`);
        }
    }

    // ─── Join / Leave ─────────────────────────────────────────────────────────

    @SubscribeMessage('join_chat')
    async handleJoinChat(
        @MessageBody() data: { chat_id: string; device_id?: string },
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const userId = client.handshake.auth.userId || client.handshake.query.userId as string;
            const deviceId = data.device_id || 'default';
            const language = (client.handshake.query.language as Language) || Language.uz;

            const chat = await this.chatService.getChat(data.chat_id, userId, language);

            this.sessionManager.joinRoom(userId, deviceId, `chat:${data.chat_id}`);

            client.emit('joined_chat', { success: true, chat_id: data.chat_id, chat_info: chat });

            this.sessionManager.emitToRoom(`chat:${data.chat_id}`, 'user_joined', {
                user_id: userId,
                chat_id: data.chat_id,
                timestamp: new Date(),
            });
        } catch (error) {
            client.emit('error', { event: 'join_chat', message: error.message });
        }
    }

    @SubscribeMessage('leave_chat')
    handleLeaveChat(
        @MessageBody() data: { chat_id: string; device_id?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const userId = client.handshake.auth.userId || client.handshake.query.userId as string;
        const deviceId = data.device_id || 'default';

        this.sessionManager.leaveRoom(userId, deviceId, `chat:${data.chat_id}`);
        client.emit('left_chat', { success: true, chat_id: data.chat_id });

        this.sessionManager.emitToRoom(`chat:${data.chat_id}`, 'user_left', {
            user_id: userId,
            chat_id: data.chat_id,
            timestamp: new Date(),
        });
    }

    // ─── Messaging ───────────────────────────────────────────────────────────

    @SubscribeMessage('send_message')
    async handleSendMessage(
        @MessageBody() data: SocketMessageDto,
        @ConnectedSocket() client: Socket,
    ) {
        try {
            // sender_id body'dan EMAS, socket auth'dan olinadi (xavfsiz)
            const senderId = client.handshake.auth.userId || client.handshake.query.userId as string;

            if (!senderId) {
                client.emit('error', { event: 'send_message', message: 'Autentifikatsiya talab qilinadi' });
                return;
            }

            const savedMessage = await this.chatService.sendMessage(
                { chat_id: data.chat_id, message: data.message, language: data.language },
                senderId,
            );

            // Chat room dagi barcha foydalanuvchilarga yangi xabar yuborish
            this.server.to(`chat:${data.chat_id}`).emit('new_message', savedMessage);

            // Jo'natuvchiga tasdiqlash
            client.emit('message_sent', { success: true, message: savedMessage });

            this.logger.log(`📨 Socket message in chat ${data.chat_id} by ${senderId}`);
        } catch (error) {
            client.emit('error', { event: 'send_message', message: error.message });
        }
    }

    @SubscribeMessage('delete_message')
    async handleDeleteMessage(
        @MessageBody() data: { message_id: string },
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const userId = client.handshake.auth.userId || client.handshake.query.userId as string;
            const result = await this.chatService.deleteMessage(data.message_id, userId);

            // Chatdagi hamma foydalanuvchilarga xabar o'chirildi deb xabar berish
            this.server.to(`chat:${result.chat_id}`).emit('message_deleted', {
                message_id: result.message_id,
                chat_id: result.chat_id,
            });

            client.emit('message_delete_confirmed', result);
        } catch (error) {
            client.emit('error', { event: 'delete_message', message: error.message });
        }
    }

    // ─── Read receipts ───────────────────────────────────────────────────────

    @SubscribeMessage('mark_read')
    async handleMarkRead(
        @MessageBody() data: { chat_id: string },
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const userId = client.handshake.auth.userId || client.handshake.query.userId as string;
            const result = await this.chatService.markMessagesAsRead(data.chat_id, userId);

            // Boshqa ishtirokchilarga xabarlar o'qilganligini bildirish
            this.server.to(`chat:${data.chat_id}`).except(client.id).emit('messages_read', {
                chat_id: data.chat_id,
                read_by: userId,
                timestamp: new Date(),
            });

            client.emit('mark_read_confirmed', result);
        } catch (error) {
            client.emit('error', { event: 'mark_read', message: error.message });
        }
    }

    // ─── Typing ──────────────────────────────────────────────────────────────

    @SubscribeMessage('typing')
    handleTyping(
        @MessageBody() data: SocketTypingDto,
        @ConnectedSocket() client: Socket,
    ) {
        const userId = client.handshake.auth.userId || client.handshake.query.userId as string;

        client.to(`chat:${data.chat_id}`).emit('user_typing', {
            chat_id: data.chat_id,
            user_id: userId,
            is_typing: data.is_typing,
            timestamp: new Date(),
        });
    }

    // ─── Online users ────────────────────────────────────────────────────────

    @SubscribeMessage('get_online_users')
    handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
        const onlineUsers = this.sessionManager.getAllOnlineUsers();
        client.emit('online_users', { users: onlineUsers, count: onlineUsers.length });
    }

    // ─── Public emit metodlar (HTTP controller uchun) ────────────────────────

    emitNewMessage(chatId: string, message: any) {
        this.server.to(`chat:${chatId}`).emit('new_message', message);
    }

    emitMessageDeleted(chatId: string, messageId: string) {
        this.server.to(`chat:${chatId}`).emit('message_deleted', {
            message_id: messageId,
            chat_id: chatId,
        });
    }

    emitMessagesRead(chatId: string, readByUserId: string) {
        this.server.to(`chat:${chatId}`).emit('messages_read', {
            chat_id: chatId,
            read_by: readByUserId,
            timestamp: new Date(),
        });
    }
}
