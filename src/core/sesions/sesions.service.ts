import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

export interface DeviceSessions {
    [deviceId: string]: string[]; // deviceId -> socketIds[]
}

@Injectable()
export class SessionManager {
    private readonly logger = new Logger(SessionManager.name);
    private server: Server;
    private sessions: Record<string, DeviceSessions> = {}; // userId -> DeviceSessions

    /**
     * Socket.io server instansiyasini o‘rnatish
     */
    setServer(server: Server) {
        this.server = server;
    }

    // ======================= CONNECTION MANAGEMENT =======================

    /**
     * Yangi ulanishni ro‘yxatga qo‘shadi
     * @param userId - foydalanuvchi ID
     * @param deviceId - qurilma ID
     * @param socketId - socket identifikatori
     */
    registerConnection(userId: string, deviceId: string, socketId: string) {
        if (!this.sessions[userId]) this.sessions[userId] = {};
        if (!this.sessions[userId][deviceId]) this.sessions[userId][deviceId] = [];

        this.sessions[userId][deviceId].push(socketId);

        this.logger.debug(`✅ User ${userId} (${deviceId}) connected -> socket ${socketId}`);
    }

    /**
     * Ulanishni o‘chiradi (disconnect bo‘lganda)
     * @param userId - foydalanuvchi ID
     * @param deviceId - qurilma ID
     * @param socketId - socket identifikatori
     */
    unregisterConnection(userId: string, deviceId: string, socketId: string) {
        if (this.sessions[userId]?.[deviceId]) {
            this.sessions[userId][deviceId] =
                this.sessions[userId][deviceId].filter(id => id !== socketId);

            if (this.sessions[userId][deviceId].length === 0) {
                delete this.sessions[userId][deviceId];
            }

            if (Object.keys(this.sessions[userId]).length === 0) {
                delete this.sessions[userId];
            }

            this.logger.debug(`❌ User ${userId} (${deviceId}) disconnected -> socket ${socketId}`);
        }
    }

    // ======================= DIRECT MESSAGING =======================

    /**
     * Foydalanuvchining barcha qurilmalari orqali xabar yuboradi
     * @param userId - foydalanuvchi ID
     * @param event - socket hodisa nomi
     * @param payload - yuboriladigan ma’lumot
     */
    emitToUser(userId: string, event: string, payload: any) {
        const devices = this.sessions[userId] || {};
        Object.values(devices).forEach(socketIds => {
            socketIds.forEach(id => this.server.to(id).emit(event, payload));
        });
    }

    /**
     * Foydalanuvchining faqat bitta qurilmasiga xabar yuboradi
     * @param userId - foydalanuvchi ID
     * @param deviceId - qurilma ID
     * @param event - socket hodisa nomi
     * @param payload - yuboriladigan ma’lumot
     */
    emitToDevice(userId: string, deviceId: string, event: string, payload: any) {
        const sockets = this.sessions[userId]?.[deviceId] || [];
        sockets.forEach(id => this.server.to(id).emit(event, payload));
    }

    // ======================= ROOM / GROUP MANAGEMENT =======================

    /**
     * Foydalanuvchining qurilmasini berilgan xonaga qo‘shadi
     * @param userId - foydalanuvchi ID
     * @param deviceId - qurilma ID
     * @param roomId - xona (channel/group) identifikatori
     */
    joinRoom(userId: string, deviceId: string, roomId: string) {
        const sockets = this.sessions[userId]?.[deviceId] || [];
        sockets.forEach(id => this.server.sockets.sockets.get(id)?.join(roomId));
        this.logger.debug(`👥 User ${userId} joined room ${roomId}`);
    }

    /**
     * Foydalanuvchini berilgan xonadan chiqaradi
     * @param userId - foydalanuvchi ID
     * @param deviceId - qurilma ID
     * @param roomId - xona identifikatori
     */
    leaveRoom(userId: string, deviceId: string, roomId: string) {
        const sockets = this.sessions[userId]?.[deviceId] || [];
        sockets.forEach(id => this.server.sockets.sockets.get(id)?.leave(roomId));
        this.logger.debug(`👤 User ${userId} left room ${roomId}`);
    }

    /**
     * Berilgan xonadagi barcha foydalanuvchilarga xabar yuboradi
     * @param roomId - xona (channel/group) identifikatori
     * @param event - socket hodisa nomi
     * @param payload - yuboriladigan ma’lumot
     */
    emitToRoom(roomId: string, event: string, payload: any) {
        this.server.to(roomId).emit(event, payload);
        this.logger.debug(`📢 Event "${event}" sent to room ${roomId}`);
    }

    // ======================= HELPERS =======================

    /**
     * Hozir onlayn bo‘lgan barcha foydalanuvchilar ID ro‘yxatini qaytaradi
     */
    listOnlineUsers(): string[] {
        return Object.keys(this.sessions);
    }

    /**
     * Foydalanuvchining qaysi qurilmalari onlayn ekanligini qaytaradi
     * @param userId - foydalanuvchi ID
     */
    listUserDevices(userId: string): string[] {
        return Object.keys(this.sessions[userId] || {});
    }

    /**
     * Foydalanuvchi onlaynmi yoki yo‘qmi tekshiradi
     * @param userId - foydalanuvchi ID
     */
    isUserConnected(userId: string): boolean {
        return !!this.sessions[userId];
    }

    /**
     * Rasm yuborish (img tag bilan)
     */
    sendImage(userId: string, url: string) {
        const html = `<img src="${url}" alt="image" style="max-width:300px; border-radius:8px;" />`;
        this.emitToUser(userId, 'file-message', { type: 'image', html });
    }

    /**
     * Audio yuborish (audio tag bilan)
     */
    sendAudio(userId: string, url: string) {
        const html = `
        <audio controls style="width:250px;">
            <source src="${url}" type="audio/mpeg">
            Your browser does not support the audio element.
        </audio>`;
        this.emitToUser(userId, 'file-message', { type: 'audio', html });
    }

    /**
     * Video yuborish (video tag bilan)
     */
    sendVideo(userId: string, url: string) {
        const html = `
        <video controls style="max-width:300px; border-radius:8px;">
            <source src="${url}" type="video/mp4">
            Your browser does not support the video tag.
        </video>`;
        this.emitToUser(userId, 'file-message', { type: 'video', html });
    }

    /**
     * Fayl yuborish (link bilan)
     */
    sendFile(userId: string, url: string, filename: string) {
        const html = `
        <a href="${url}" download="${filename}" 
           style="color:blue; text-decoration:underline;">
           📎 ${filename}
        </a>`;
        this.emitToUser(userId, 'file-message', { type: 'file', html });
    }
    /**
 * Hozir online bo‘lgan barcha userId larni qaytaradi
 */
    getAllOnlineUsers(): string[] {
        return Object.keys(this.sessions);
    }

}
