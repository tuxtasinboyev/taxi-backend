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

    private extractUserId(client: Socket) {
        return (client.handshake.auth.userId || client.handshake.query.userId) as string;
    }

    private extractDeviceId(client: Socket) {
        return (client.handshake.auth.deviceId || client.handshake.query.deviceId || 'default') as string;
    }

    private adminRoom(scope: 'list' | 'support' | 'order' | 'chat', id?: string) {
        if (scope === 'chat' && id) return `admin:chat:${id}`;
        if (scope === 'support') return 'admin:chat:support';
        if (scope === 'order') return 'admin:chat:order';
        return 'admin:chat:list';
    }

    private async ensureAdminAccess(userId: string) {
        const isPrivileged = await this.chatService.isPrivilegedUser(userId);
        if (!isPrivileged) {
            throw new Error('Admin yoki superadmin ruxsati talab qilinadi');
        }
    }

    private async emitAdminChatListEvent(
        event: string,
        chatId: string,
        extra: Record<string, any> = {},
        language: Language = Language.uz,
    ) {
        const [chat, meta] = await Promise.all([
            this.chatService.getAdminChat(chatId, language),
            this.chatService.getChatMeta(chatId),
        ]);

        const payload = {
            chat,
            trigger: event,
            ...meta,
            ...extra,
        };

        this.server.to(this.adminRoom('list')).emit(event, payload);

        if (meta.type === 'support') {
            this.server.to(this.adminRoom('support')).emit(event, payload);
        }

        if (meta.type === 'order') {
            this.server.to(this.adminRoom('order')).emit(event, payload);
        }

        this.server.to(this.adminRoom('chat', chatId)).emit(event, payload);
    }

    afterInit() {
        this.sessionManager.setServer(this.server);
        this.logger.log('🚀 Chat Gateway initialized');
    }

    async handleConnection(client: Socket) {
        try {
            const userId = this.extractUserId(client);
            const deviceId = this.extractDeviceId(client);

            if (!userId) {
                client.emit('error', { message: 'userId talab qilinadi' });
                client.disconnect();
                return;
            }

            this.sessionManager.registerConnection(userId, deviceId, client.id);

            // Foydalanuvchi ishtirok etayotgan barcha chatlarga avtomatik qo'shish
            const chatIds = await this.chatService.getUserChatIds(userId);
            chatIds.forEach(chatId => client.join(`chat:${chatId}`));

            if (await this.chatService.isPrivilegedUser(userId)) {
                client.join(this.adminRoom('list'));
                client.join(this.adminRoom('support'));
                client.join(this.adminRoom('order'));
            }

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
        const userId = this.extractUserId(client);
        const deviceId = this.extractDeviceId(client);

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

    @SubscribeMessage('admin:subscribe_chats')
    async handleAdminSubscribeChats(
        @MessageBody() data: { scope?: 'all' | 'support' | 'order' },
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const userId = this.extractUserId(client);
            await this.ensureAdminAccess(userId);

            const scope = data?.scope || 'all';
            if (scope === 'all') client.join(this.adminRoom('list'));
            if (scope === 'support') client.join(this.adminRoom('support'));
            if (scope === 'order') client.join(this.adminRoom('order'));

            client.emit('admin:subscribed_chats', {
                success: true,
                scope,
            });
        } catch (error) {
            client.emit('error', { event: 'admin:subscribe_chats', message: error.message });
        }
    }

    @SubscribeMessage('admin:join_chat')
    async handleAdminJoinChat(
        @MessageBody() data: { chat_id: string; language?: Language },
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const userId = this.extractUserId(client);
            await this.ensureAdminAccess(userId);

            const language = data.language || Language.uz;
            const chat = await this.chatService.getAdminChat(data.chat_id, language);
            client.join(this.adminRoom('chat', data.chat_id));

            client.emit('admin:joined_chat', {
                success: true,
                chat_id: data.chat_id,
                chat_info: chat,
            });
        } catch (error) {
            client.emit('error', { event: 'admin:join_chat', message: error.message });
        }
    }

    @SubscribeMessage('admin:leave_chat')
    async handleAdminLeaveChat(
        @MessageBody() data: { chat_id: string },
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const userId = this.extractUserId(client);
            await this.ensureAdminAccess(userId);

            client.leave(this.adminRoom('chat', data.chat_id));
            client.emit('admin:left_chat', {
                success: true,
                chat_id: data.chat_id,
            });
        } catch (error) {
            client.emit('error', { event: 'admin:leave_chat', message: error.message });
        }
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
            await this.emitAdminChatListEvent('admin:chat:new_message', data.chat_id, {
                message: savedMessage,
            }, data.language);

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
            await this.emitAdminChatListEvent('admin:chat:message_deleted', result.chat_id, {
                message_id: result.message_id,
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
            await this.emitAdminChatListEvent('admin:chat:messages_read', data.chat_id, {
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
        client.to(this.adminRoom('chat', data.chat_id)).emit('admin:chat:typing', {
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

    async emitNewMessage(chatId: string, message: any) {
        this.server.to(`chat:${chatId}`).emit('new_message', message);
        await this.emitAdminChatListEvent('admin:chat:new_message', chatId, {
            message,
        });
    }

    async emitMessageDeleted(chatId: string, messageId: string) {
        this.server.to(`chat:${chatId}`).emit('message_deleted', {
            message_id: messageId,
            chat_id: chatId,
        });
        await this.emitAdminChatListEvent('admin:chat:message_deleted', chatId, {
            message_id: messageId,
        });
    }

    async emitMessagesRead(chatId: string, readByUserId: string) {
        this.server.to(`chat:${chatId}`).emit('messages_read', {
            chat_id: chatId,
            read_by: readByUserId,
            timestamp: new Date(),
        });
        await this.emitAdminChatListEvent('admin:chat:messages_read', chatId, {
            read_by: readByUserId,
            timestamp: new Date(),
        });
    }

    emitChatCreated(chat: any) {
        const payload = {
            chat,
            trigger: 'admin:chat:created',
            order_id: chat.order_id,
            order_status: chat.order_status,
            type: chat.type,
        };

        this.server.to(this.adminRoom('list')).emit('admin:chat:created', payload);

        if (chat.type === 'support') {
            this.server.to(this.adminRoom('support')).emit('admin:chat:created', payload);
        }

        if (chat.type === 'order') {
            this.server.to(this.adminRoom('order')).emit('admin:chat:created', payload);
        }
    }
}
