export interface SendMessagePayload {
    senderId: string;
    chatId: string;
    receiverId?: string | null;
    contentText?: string;
    files?: string[];
}
